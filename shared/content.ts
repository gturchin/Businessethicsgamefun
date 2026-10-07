import type { Strategy } from './model';
export const plans = [
  { id: 'public', title: 'Public rebuild', tag: 'Plan A', body: 'Government purchases key properties and pays for cleanup and infrastructure before seeking businesses.', benefits: ['More public control', 'Sites become easier to develop'], tradeoff: 'Large taxpayer cost' },
  { id: 'private', title: 'Private redevelopment', tag: 'Plan B', body: 'Sell sites cheaply to companies willing to clean and redevelop them.', benefits: ['Lower direct public spending', 'Private investment drives redevelopment'], tradeoff: 'Difficult properties may remain abandoned' },
  { id: 'shared', title: 'Shared investment', tag: 'Plan C', body: 'Government assists with cleanup and infrastructure. Businesses finance facilities and part of redevelopment.', benefits: ['Shared financial risk', 'Could attract additional companies'], tradeoff: 'Public money supports private development' }
];
export const commitments = [
  { id: 'pollution', title: 'Advanced pollution controls', body: 'Technology that goes beyond minimum requirements.' },
  { id: 'renewables', title: 'Renewable energy', body: 'Invest in cleaner power for the facility.' },
  { id: 'hiring', title: 'Local hiring targets', body: 'Make new jobs accessible to existing residents.' },
  { id: 'training', title: 'Job-training programs', body: 'Help residents develop skills for new work.' },
  { id: 'parks', title: 'Parks & public spaces', body: 'Invest in shared places outside the factory.' },
  { id: 'monitoring', title: 'Community environmental monitoring', body: 'Give residents access to independent environmental data.' }
];
export const expansion = [
  { id: 'approve', title: 'Approve', body: 'The project meets existing laws.' },
  { id: 'conditions', title: 'Approve with environmental conditions', body: 'Expansion occurs only with substantial emissions improvements.' },
  { id: 'negotiate', title: 'Require community negotiation', body: 'Residents and company negotiate additional environmental and community benefits.' },
  { id: 'reject', title: 'Reject', body: 'Move future growth away from heavy industry.' }
];
export const roundTitles = ['The redevelopment plan', 'The $8 million decision', 'What does business owe?', 'Who gets power?', 'Five years later'];
export const scenarios = [
  "Testing finds extensive contamination across Riverton’s abandoned industrial district. Cleanup will cost millions before much of the land can be safely redeveloped.",
  'A consumer-products manufacturer proposes $100 million in private investment and 150 jobs. Additional contamination is discovered. Cleanup will cost $8 million.',
  'The manufacturer will follow all existing environmental laws. In exchange for public support, Riverton can require two additional commitments.',
  'Residents argue that industrial development has historically happened TO their neighborhood rather than WITH them. How much decision-making power should existing residents have?',
  'Riverton has new jobs, new investment, and less vacant land. The manufacturer wants to double its facility: 200 more jobs and $75 million in investment, with more truck traffic, higher total emissions, and more industrial activity near homes.'
];
export const discussions = [
  'Who should bear the financial risk of repairing environmental damage created decades ago?',
  'If the new company did not create the original pollution, how much responsibility should it have for cleaning it up?',
  'Is a business responsible only for its direct impact, or also for the community around it?',
  'Should people who experience the environmental risk have more power than people who receive the economic benefits?',
  'When economic opportunity comes with environmental risk, who should decide what counts as progress?'
];
export const strategyInfo: Record<Strategy, { title: string; description: string }> = {
  public: { title: 'Public-led protector', description: 'You looked to government to repair historic damage and shape what comes next. Your pattern favors public investment, oversight, and protection of the community as redevelopment moves forward.' },
  corporate: { title: 'Corporate responsibility', description: 'You expected companies benefiting from redevelopment to carry meaningful financial and environmental obligations. Your choices put business responsibility at the center of Riverton’s future.' },
  community: { title: 'Community-first development', description: 'You gave existing residents a meaningful voice in the decisions that affect their homes. Your pattern favors community power and negotiated benefits as Riverton grows.' },
  growth: { title: 'Growth-first development', description: 'You emphasized jobs, new investment, and a viable path to redevelopment. Your choices favor economic opportunity while relying more on existing rules and private investment.' },
  shared: { title: 'Shared responsibility', description: 'You distributed responsibility across government, business, and existing residents. You accepted some public investment while expecting businesses to take on environmental and community obligations.' }
};
export const priorityLabels = { government: 'Government intervention', business: 'Business responsibility', community: 'Community power', environment: 'Environmental protection', economy: 'Economic development' };
export const pollQuestion = 'If a company follows every environmental law but knowingly causes disproportionate harm to a low-income community, has it fulfilled its ethical responsibility?';
export const pollChoices = [{ id: 'yes', title: 'Yes' }, { id: 'no', title: 'No' }, { id: 'depends', title: 'It depends' }];
export const sources = [
  { title: 'Method facility: sustainable design', url: 'https://mcdonoughpartners.com/projects/method-home/' },
  { title: 'Method: redevelopment and financing', url: 'https://www.cnigroup.org/project/method-south-side-soapbox/' },
  { title: 'Menomonee Valley: redevelopment history', url: 'https://www.thevalleymke.org/history' },
  { title: 'Menomonee Valley: industrial center', url: 'https://www.thevalleymke.org/mvic' }
];
