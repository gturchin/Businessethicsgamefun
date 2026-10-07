import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
const python = resolve('.local/azure-cli/bin/python');
const azCommand = process.env.RIVERTON_AZ || (existsSync(python) ? python : 'az');
const prefix = azCommand === python ? ['-m', 'azure.cli'] : [];
function az(args) {
  const r = spawnSync(azCommand, [...prefix, ...args, '--only-show-errors'], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (r.status !== 0) {
    // Never include arguments or stdout: settings and deployment responses may contain secrets.
    const error = new Error(`Azure operation failed: ${args.slice(0, 3).join(' ')}. ${args[0] === 'account' ? 'Run Azure CLI login first.' : 'Check subscription permissions, allowed regions, and resource availability.'}`);
    throw error;
  }
  return r.stdout.trim();
}
function run(command, args, env = process.env) { const r = spawnSync(command, args, { stdio: 'inherit', env }); if (r.status !== 0) throw new Error(`${command} failed.`); }
async function main() {
  const account = JSON.parse(az(['account', 'show', '-o', 'json']));
  if (account.state !== 'Enabled') throw new Error('Select an enabled Azure subscription first.');
  // Stop before provisioning if build or tests fail.
  run('npm', ['test']); run('npm', ['run', 'build']);
  const manifestPath = '.azure-deploy.json';
  const existing = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : undefined;
  if (existing?.subscriptionId && existing.subscriptionId !== account.id) throw new Error('Saved resources belong to another subscription. Select that subscription before redeploying.');
  const suffix = randomBytes(4).toString('hex');
  const useFunctions = !process.argv.includes('--static-web-apps');
  const config = existing ?? { mode: useFunctions ? 'functions' : 'static-web-apps', resourceGroup: 'rg-rebuild-riverton', app: useFunctions ? `rebuild-riverton-${suffix}` : 'rebuild-riverton', storage: `riverton${suffix}`, location: process.env.RIVERTON_AZURE_REGION || (useFunctions ? 'westus' : 'westus2'), subscriptionId: account.id };
  if (existing && existing.mode !== (useFunctions ? 'functions' : 'static-web-apps')) throw new Error('Requested hosting differs from the saved deployment. Use the saved hosting mode.');
  // Save resource names before creation so a retry reuses partial provisioning.
  await writeFile(manifestPath, JSON.stringify(config, null, 2));
  console.log(`Provisioning ${useFunctions ? 'Functions Consumption hosting' : 'Free Static Web Apps'} and Standard LRS storage in ${config.location}.`);
  for (const namespace of ['Microsoft.Storage', 'Microsoft.Web']) {
    if (az(['provider', 'show', '--namespace', namespace, '--query', 'registrationState', '-o', 'tsv']) !== 'Registered') {
      console.log(`Registering ${namespace} for this subscription.`);
      az(['provider', 'register', '--namespace', namespace, '--wait']);
    }
  }
  az(['group', 'create', '-n', config.resourceGroup, '-l', config.location, '-o', 'none']);
  az(['storage', 'account', 'create', '-n', config.storage, '-g', config.resourceGroup, '-l', config.location, '--sku', 'Standard_LRS', '--kind', 'StorageV2', '--min-tls-version', 'TLS1_2', '--https-only', 'true', '--allow-blob-public-access', 'false', '-o', 'none']);
  const connection = az(['storage', 'account', 'show-connection-string', '-n', config.storage, '-g', config.resourceGroup, '--query', 'connectionString', '-o', 'tsv']);
  const creation = spawnSync(azCommand, [...prefix, 'storage', 'table', 'create', '--name', 'Riverton', '-o', 'none', '--only-show-errors'], { encoding: 'utf8', env: { ...process.env, AZURE_STORAGE_CONNECTION_STRING: connection } });
  if (creation.status !== 0) throw new Error('Could not create the Riverton table.');
  if (useFunctions) {
    const app = JSON.parse(az(['functionapp', 'create', '-n', config.app, '-g', config.resourceGroup, '-s', config.storage, '--consumption-plan-location', config.location, '--os-type', 'Windows', '--runtime', 'node', '--runtime-version', '22', '--functions-version', '4', '--disable-app-insights', 'true', '--https-only', 'true', '-o', 'json']));
    const directory = await mkdtemp(join(tmpdir(), 'riverton-settings-'));
    try {
      const settings = join(directory, 'settings.json');
      await writeFile(settings, JSON.stringify({ RIVERTON_STORAGE_CONNECTION: connection, RIVERTON_SERVE_FRONTEND: 'true', WEBSITE_RUN_FROM_PACKAGE: '1', WEBSITE_NODE_DEFAULT_VERSION: '~22', SCM_DO_BUILD_DURING_DEPLOYMENT: 'false', AzureWebJobsDisableHomepage: 'true' }), { mode: 0o600 });
      az(['functionapp', 'config', 'appsettings', 'set', '-n', config.app, '-g', config.resourceGroup, '--settings', `@${settings}`, '-o', 'none']);
    } finally { await rm(directory, { recursive: true, force: true }); }
    run('node', ['scripts/package-functions.mjs']);
    console.log('Publishing the combined frontend and API package.');
    az(['functionapp', 'deployment', 'source', 'config-zip', '-n', config.app, '-g', config.resourceGroup, '--src', resolve('.local/function-package.zip'), '--build-remote', 'false', '--timeout', '600', '-o', 'none']);
    config.url = `https://${app.defaultHostName}`; await writeFile(manifestPath, JSON.stringify(config, null, 2));
    console.log(`Deployed: ${config.url}`);
    return;
  }
  const app = JSON.parse(az(['staticwebapp', 'create', '-n', config.app, '-g', config.resourceGroup, '-l', config.location, '--sku', 'Free', '-o', 'json']));
  const directory = await mkdtemp(join(tmpdir(), 'riverton-settings-'));
  try {
    const settings = join(directory, 'settings.json');
    await writeFile(settings, JSON.stringify({ properties: { RIVERTON_STORAGE_CONNECTION: connection } }), { mode: 0o600 });
    az(['rest', '--method', 'put', '--url', `https://management.azure.com${app.id}/config/appsettings?api-version=2023-12-01`, '--body', `@${settings}`, '-o', 'none']);
  } finally { await rm(directory, { recursive: true, force: true }); }
  const deploymentToken = az(['staticwebapp', 'secrets', 'list', '-n', config.app, '-g', config.resourceGroup, '--query', 'properties.apiKey', '-o', 'tsv']);
  // Secret is passed only in the subprocess environment, never a command argument or source file.
  run('npx', ['--yes', '--package', '@azure/static-web-apps-cli@2.0.10', 'swa', 'deploy', './dist', '--api-location', './api', '--api-language', 'node', '--api-version', '22', '--env', 'production'], { ...process.env, SWA_CLI_DEPLOYMENT_TOKEN: deploymentToken });
  config.url = `https://${app.defaultHostname}`; await writeFile(manifestPath, JSON.stringify(config, null, 2));
  console.log(`Deployed: ${config.url}`);
  // GitHub Actions can use the same built artifacts on a manual workflow dispatch.
  const gh = spawnSync('gh', ['secret', 'set', 'AZURE_STATIC_WEB_APPS_API_TOKEN', '--repo', 'gturchin/Businessethicsgamefun'], { input: deploymentToken, encoding: 'utf8' });
  if (gh.status !== 0) console.log('Deployment succeeded. GitHub deployment secret could not be set; direct redeploy remains available.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
