#!/usr/bin/env node
const {
  inspectParcelSchema,
  inspectAssessorLayers,
  inspectAssessorLayerFields
} = require('../src/schemaInspector');

async function main() {
  const [, , cmd, arg] = process.argv;

  switch (cmd) {
    case 'parcel':
      await inspectParcelSchema();
      break;
    case 'assessor-layers':
      await inspectAssessorLayers();
      break;
    case 'assessor-fields':
      await inspectAssessorLayerFields(Number(arg));
      break;
    default:
      console.log('Usage: node bin/inspect-schema.js <parcel|assessor-layers|assessor-fields> [layerIndex]');
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Schema inspection failed:', err);
  process.exit(1);
});
