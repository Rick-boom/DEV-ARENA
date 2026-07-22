import nodeConfig from '@devarena/eslint-config/node';

export default [...nodeConfig, { ignores: ['dist/**'] }];
