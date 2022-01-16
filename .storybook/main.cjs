module.exports = {
  "stories": [
    "../src/**/*.stories.mdx",
    "../src/**/*.stories.@(js|ts)"
  ],
  "addons": [
    "@storybook/addon-links",
    "@storybook/addon-essentials"
  ],
  "core": {
    "builder": "webpack5"
  },
  // this hack allows to use class field properties
  // See https://github.com/storybookjs/storybook/issues/12578#issuecomment-702664081
  babel: async (options) => {
    Object.assign(options.plugins.find((plugin) => plugin[0].includes('plugin-proposal-decorators'))[1], {
      decoratorsBeforeExport: true,
      legacy: false
    })
    return options;
  },
};
