import '../../node_modules/regenerator-runtime/runtime.js';
import '../../dist/snjs.js';
import '../../node_modules/chai/chai.js';
import './../vendor/chai-as-promised-built.js';
import Factory from '../lib/factory.js';
chai.use(chaiAsPromised);
var expect = chai.expect;

describe("items", () => {
  const createModelManager = async () => {
    const isolatedApplication = await Factory.createInitAppWithRandNamespace();
    return isolatedApplication.modelManager;
  }

  it('setting an item as dirty should update its client updated at', async () => {
    let modelManager = await createModelManager();
    var params = Factory.createNotePayload();
    await modelManager.mapPayloadsToLocalItems({payloads: [params]});
    let item = modelManager.items[0];
    var prevDate = item.client_updated_at.getTime();
    await Factory.sleep(0.1);
    await modelManager.setItemDirty(item, true, true);
    var newDate = item.client_updated_at.getTime();
    expect(prevDate).to.not.equal(newDate);
  });

  it('setting an item as dirty with option to skip client updated at', async () => {
    let modelManager = await createModelManager();
    var params = Factory.createNotePayload();
    await modelManager.mapPayloadsToLocalItems({payloads: [params]});
    let item = modelManager.items[0];
    var prevDate = item.client_updated_at.getTime();
    await Factory.sleep(0.1);
    await modelManager.setItemDirty(item, true);
    var newDate = item.client_updated_at.getTime();
    expect(prevDate).to.equal(newDate);
  });

  it('properly pins, archives, and locks', async () => {
    let modelManager = await createModelManager();
    var params = Factory.createNotePayload();
    await modelManager.mapPayloadsToLocalItems({payloads: [params]});

    let item = modelManager.items[0];
    expect(item.pinned).to.not.be.ok;

    item.setAppDataItem("pinned", true);
    expect(item.pinned).to.equal(true);

    item.setAppDataItem("archived", true);
    expect(item.archived).to.equal(true);

    item.setAppDataItem("locked", true);
    expect(item.locked).to.equal(true);
  });

  it('properly compares item equality', async () => {
    let modelManager = await createModelManager();
    var params1 = Factory.createNotePayload();
    var params2 = Factory.createNotePayload();
    await modelManager.mapPayloadsToLocalItems({payloads: [params1, params2]});

    let item1 = modelManager.items[0];
    let item2 = modelManager.items[1];

    expect(item1.isItemContentEqualWith(item2)).to.equal(true);

    // items should ignore this field when checking for equality
    item1.client_updated_at = new Date();
    item2.client_updated_at = null;

    expect(item1.isItemContentEqualWith(item2)).to.equal(true);

    item1.content.foo = "bar";

    expect(item1.isItemContentEqualWith(item2)).to.equal(false);

    item2.content.foo = "bar";

    expect(item1.isItemContentEqualWith(item2)).to.equal(true);
    expect(item2.isItemContentEqualWith(item1)).to.equal(true);

    item1.addItemAsRelationship(item2);
    item2.addItemAsRelationship(item1);

    expect(item1.content.references.length).to.equal(1);
    expect(item2.content.references.length).to.equal(1);

    expect(item1.isItemContentEqualWith(item2)).to.equal(false);

    item1.removeItemAsRelationship(item2);
    item2.removeItemAsRelationship(item1);

    expect(item1.isItemContentEqualWith(item2)).to.equal(true);
    expect(item1.content.references.length).to.equal(0);
    expect(item2.content.references.length).to.equal(0);
  });

  it('content equality should not have side effects', async () => {
    let modelManager = await createModelManager();
    var params1 = Factory.createNotePayload();
    var params2 = Factory.createNotePayload();
    await modelManager.mapPayloadsToLocalItems({payloads: [params1, params2]});

    let item1 = modelManager.items[0];
    let item2 = modelManager.items[1];

    item1.content.foo = "bar";
    expect(item1.content.foo).to.equal("bar");

    item1.contentKeysToIgnoreWhenCheckingEquality = () => {
      return ["foo"];
    }

    item2.contentKeysToIgnoreWhenCheckingEquality = () => {
      return ["foo"];
    }

    // calling isItemContentEqualWith should not have side effects
    // There was an issue where calling that function would modify values directly to omit keys
    // in contentKeysToIgnoreWhenCheckingEquality.

    await modelManager.setItemsDirty([item1, item2], true);

    expect(item1.getAppDataItem("client_updated_at")).to.be.ok;
    expect(item2.getAppDataItem("client_updated_at")).to.be.ok;

    expect(item1.isItemContentEqualWith(item2)).to.equal(true);
    expect(item2.isItemContentEqualWith(item1)).to.equal(true);

    expect(item1.getAppDataItem("client_updated_at")).to.be.ok;
    expect(item2.getAppDataItem("client_updated_at")).to.be.ok;

    expect(item1.content.foo).to.equal("bar");
  })
})
