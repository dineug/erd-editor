const replaceVars = [
  {
    regex: /^VITE_/,
    replacement: (template, variableName) =>
      template.expression('process.env.%%variableName%%')({ variableName }),
  },
];

function getReplacement(variableName, template) {
  return replaceVars
    .filter(({ regex }) => regex.test(variableName))
    .map(({ replacement }) => replacement(template, variableName))[0];
}

module.exports = function importMetaEnvBabelPlugin({ template, types: t }) {
  return {
    name: 'import-meta-env',
    visitor: {
      MemberExpression(path) {
        const envNode =
          t.isMemberExpression(path.node.object) && path.node.object;
        const variableName =
          t.isIdentifier(path.node.property) && path.node.property.name;

        if (!envNode || !variableName) {
          return;
        }

        const isMetaProperty = t.isMetaProperty(envNode.object);
        const isEnvVar =
          t.isIdentifier(envNode.property) && envNode.property.name === 'env';

        if (!isMetaProperty || !isEnvVar) {
          return;
        }

        const replacement = getReplacement(variableName, template);

        if (replacement) {
          path.replaceWith(replacement);
        }
      },
    },
  };
};
