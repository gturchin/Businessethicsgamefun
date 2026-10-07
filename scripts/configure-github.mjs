import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const python = resolve('.local/azure-cli/bin/python');
const executable = process.env.RIVERTON_AZ || (existsSync(python) ? python : 'az');
const prefix = executable === python ? ['-m', 'azure.cli'] : [];
function call(command, args, input) {
  const result = spawnSync(command, args, { input, encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command === executable ? 'Azure ' + args.slice(prefix.length, prefix.length + 3).join(' ') : command} configuration failed. Check authentication and permissions.`);
  return result.stdout.trim();
}
const az = args => call(executable, [...prefix, ...args, '--only-show-errors']);
try {
  const config = JSON.parse(await readFile('.azure-deploy.json', 'utf8'));
  if (config.mode !== 'functions' || !config.url) throw new Error('Deploy Functions hosting first.');
  const account = JSON.parse(az(['account', 'show', '-o', 'json']));
  if (account.id !== config.subscriptionId) throw new Error('Select the deployment subscription first.');
  const remote = call('git', ['remote', 'get-url', 'origin']);
  const repo = remote.match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/)?.[1];
  if (!repo) throw new Error('Connect a GitHub origin first.');
  const branch = call('git', ['branch', '--show-current']);
  if (!branch) throw new Error('Check out the branch that will deploy.');
  call('gh', ['auth', 'status']);
  const identityName = `${config.app}-github`;
  az(['provider', 'register', '--namespace', 'Microsoft.ManagedIdentity', '--wait']);
  const identity = JSON.parse(az(['identity', 'create', '-n', identityName, '-g', config.resourceGroup, '-l', config.location, '-o', 'json']));
  const appId = az(['functionapp', 'show', '-n', config.app, '-g', config.resourceGroup, '--query', 'id', '-o', 'tsv']);
  const roles = JSON.parse(az(['role', 'assignment', 'list', '--assignee', identity.principalId, '--scope', appId, '--query', "[?roleDefinitionName=='Website Contributor']", '-o', 'json']));
  if (!roles.length) az(['role', 'assignment', 'create', '--assignee-object-id', identity.principalId, '--assignee-principal-type', 'ServicePrincipal', '--role', 'Website Contributor', '--scope', appId, '-o', 'none']);
  az(['identity', 'federated-credential', 'create', '--identity-name', identityName, '-g', config.resourceGroup, '-n', 'github-branch', '--issuer', 'https://token.actions.githubusercontent.com', '--subject', `repo:${repo}:ref:refs/heads/${branch}`, '--audiences', 'api://AzureADTokenExchange', '-o', 'none']);
  for (const [name, value] of Object.entries({ AZURE_CLIENT_ID: identity.clientId, AZURE_TENANT_ID: identity.tenantId, AZURE_SUBSCRIPTION_ID: account.id })) call('gh', ['secret', 'set', name, '--repo', repo], value);
  call('gh', ['variable', 'set', 'AZURE_FUNCTIONAPP_NAME', '--repo', repo, '--body', config.app]);
  config.github = { repo, branch, identity: identityName };
  await writeFile('.azure-deploy.json', JSON.stringify(config, null, 2));
  console.log(`GitHub OIDC configured for ${repo}, branch ${branch}. No publishing password is stored. Commit and push the workflow before dispatching it.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
