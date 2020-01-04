import '../node_modules/regenerator-runtime/runtime.js';
import '../dist/snjs.js';
import '../node_modules/chai/chai.js';
import './vendor/chai-as-promised-built.js';
import Factory from './lib/factory.js';
chai.use(chaiAsPromised);
const expect = chai.expect;

describe('payloads', () => {
  const sharedApplication = Factory.createApplication();

  before(async () => {
    localStorage.clear();
    await Factory.initializeApplication(sharedApplication);
    await Factory.registerUserToApplication({application: sharedApplication});
  });

  after(async () => {
    localStorage.clear();
  })

  it('creating payload from item should create copy not by reference', async () => {
    const item = await Factory.createMappedNote(sharedApplication.modelManager);
    const payload = CreatePayloadFromAnyObject({object: item});
    expect(item.content === payload.content).to.equal(false);
    expect(item.content.references === payload.content.references).to.equal(false);
  });

  it('creating payload from item should preserve appData', async () => {
    const item = await Factory.createMappedNote(sharedApplication.modelManager);
    const payload = CreatePayloadFromAnyObject({object: item});
    expect(item.content.appData).to.be.ok;
    expect(JSON.stringify(item.content)).to.equal(JSON.stringify(payload.content));
  });

  it('creating payload with override properties', async () => {
    const payload = Factory.createNotePayload();
    const uuid = payload.uuid;
    const changedUuid = 'foo';
    const changedPayload = CreatePayloadFromAnyObject({
      object: payload,
      override: {
        uuid: changedUuid
      }
    })

    expect(payload.uuid).to.equal(uuid);
    expect(changedPayload.uuid).to.equal(changedUuid);
  });

  it('creating payload with deep override properties', async () => {
    const payload = Factory.createNotePayload();
    const text = payload.content.text;
    const changedText = `${Math.random()}`;
    const changedPayload = CreatePayloadFromAnyObject({
      object: payload,
      override: {
        content: {
          text: changedText
        }
      }
    })

    expect(payload.content === changedPayload.content).to.equal(false);
    expect(payload.content.text).to.equal(text);
    expect(changedPayload.content.text).to.equal(changedText);
  });

  it('copying payload with override should override selected fields only', async () => {
    const item = await Factory.createMappedNote(sharedApplication.modelManager);
    const payload = CreatePayloadFromAnyObject({object: item});
    const mutated = CreatePayloadFromAnyObject({
      object: payload,
      override: {
        content: {
          foo: 'bar'
        }
      }
    })
    expect(mutated.content.text).to.equal(payload.content.text);
  });

  it('copying payload with override should copy empty arrays', async () => {
    const pair = await Factory.createRelatedNoteTagPairPayload(sharedApplication.modelManager);
    const tagPayload = pair[1];
    expect(tagPayload.content.references.length).to.equal(1);

    const mutated = CreatePayloadFromAnyObject({
      object: tagPayload,
      override: {
        content: {
          references: []
        }
      }
    })
    expect(mutated.content.references.length).to.equal(0);
  });

  it('creating payload with omit fields', async () => {
    const payload = Factory.createNotePayload();
    const uuid = payload.uuid;
    const changedUuid = 'foo';
    const changedPayload = CreatePayloadFromAnyObject({
      object: payload,
      override: {uuid: null}
    })

    expect(payload.uuid).to.equal(uuid);
    expect(changedPayload.uuid).to.not.be.ok;
  });

  it("returns valid encrypted params for syncing", async () => {
    const payload = Factory.createStorageItemNotePayload();
    const encryptedPayload = await sharedApplication.protocolManager
    .payloadByEncryptingPayload({
      payload: payload,
      intent: ENCRYPTION_INTENT_SYNC
    });
    expect(encryptedPayload.enc_item_key).to.not.be.null;
    expect(encryptedPayload.uuid).to.not.be.null;
    expect(encryptedPayload.auth_hash).to.not.be.ok;
    expect(encryptedPayload.content_type).to.not.be.null;
    expect(encryptedPayload.created_at).to.not.be.null;
    expect(encryptedPayload.content).to.satisfy((string) => {
      return string.startsWith(sharedApplication.protocolManager.latestVersion());
    });
  }).timeout(5000);

  it("returns unencrypted params with no keys", async () => {
    var payload = Factory.createStorageItemNotePayload();
    const encodedPayload = await sharedApplication.protocolManager
    .payloadByEncryptingPayload({
      payload: payload,
      intent: ENCRYPTION_INTENT_FILE_DECRYPTED
    })

    expect(encodedPayload.enc_item_key).to.not.be.ok;
    expect(encodedPayload.auth_hash).to.not.be.ok;
    expect(encodedPayload.uuid).to.not.be.null;
    expect(encodedPayload.content_type).to.not.be.null;
    expect(encodedPayload.created_at).to.not.be.null;
    /** File decrypted will result in bare object */
    expect(encodedPayload.content.title).to.equal(payload.content.title);
  });

  it("returns additional fields for local storage", async () => {
    const payload = Factory.createStorageItemNotePayload();

    const encryptedPayload = await sharedApplication.protocolManager
    .payloadByEncryptingPayload({
      payload: payload,
      intent: ENCRYPTION_INTENT_LOCAL_STORAGE_ENCRYPTED
    })

    expect(encryptedPayload.enc_item_key).to.not.be.null;
    expect(encryptedPayload.auth_hash).to.not.be.ok;
    expect(encryptedPayload.uuid).to.not.be.null;
    expect(encryptedPayload.content_type).to.not.be.null;
    expect(encryptedPayload.created_at).to.not.be.null;
    expect(encryptedPayload.updated_at).to.not.be.null;
    expect(encryptedPayload.deleted).to.not.be.null;
    expect(encryptedPayload.errorDecrypting).to.not.be.null;
    expect(encryptedPayload.content).to.satisfy((string) => {
      return string.startsWith(sharedApplication.protocolManager.latestVersion());
    });
  });

  it("omits deleted for export file", async () => {
    const payload = Factory.createStorageItemNotePayload();
    const encryptedPayload = await sharedApplication.protocolManager
    .payloadByEncryptingPayload({
      payload: payload,
      intent: ENCRYPTION_INTENT_FILE_ENCRYPTED
    })
    expect(encryptedPayload.enc_item_key).to.not.be.null;
    expect(encryptedPayload.uuid).to.not.be.null;
    expect(encryptedPayload.content_type).to.not.be.null;
    expect(encryptedPayload.created_at).to.not.be.null;
    expect(encryptedPayload.deleted).to.not.be.ok;
    expect(encryptedPayload.content).to.satisfy((string) => {
      return string.startsWith(sharedApplication.protocolManager.latestVersion());
    });
  });

  it("items with error decrypting should remain as is", async () => {
    const payload = Factory.createStorageItemNotePayload();
    const mutatedPayload = CreatePayloadFromAnyObject({
      object: payload,
      override: {
        errorDecrypting: true
      }
    })
    const encryptedPayload = await sharedApplication.protocolManager
    .payloadByEncryptingPayload({
      payload: mutatedPayload,
      intent: ENCRYPTION_INTENT_SYNC
    })
    expect(encryptedPayload.content).to.eql(payload.content);
    expect(encryptedPayload.enc_item_key).to.not.be.null;
    expect(encryptedPayload.uuid).to.not.be.null;
    expect(encryptedPayload.content_type).to.not.be.null;
    expect(encryptedPayload.created_at).to.not.be.null;
  });

})
