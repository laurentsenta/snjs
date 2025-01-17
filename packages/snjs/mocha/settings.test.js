import * as Factory from './lib/factory.js';
chai.use(chaiAsPromised);
const expect = chai.expect;

describe('settings service', function () {
  const fakeSetting = 'FAKE_SETTING';
  const fakePayload = 'Im so meta even this acronym';
  const updatedFakePayload = 'is meta';

  let snApp;

  beforeEach(async function () {
    snApp = await Factory.createInitAppWithRandNamespace(
      Environment.Web,
      Platform.MacWeb
    );
    const email = Uuid.GenerateUuidSynchronously();
    const password = Uuid.GenerateUuidSynchronously();
    const ephemeral = false;
    const mergeLocal = true;

    await snApp.register(email, password, ephemeral, mergeLocal);
  });

  afterEach(async function () {
    await Factory.safeDeinit(snApp);
  });

  it('creates and reads a setting', async function () {
    await snApp.updateSetting(fakeSetting, fakePayload);
    const responseCreate = await snApp.getSetting(fakeSetting);
    expect(responseCreate).to.equal(fakePayload);
  });

  it('creates and lists settings', async function () {
    await snApp.updateSetting(fakeSetting, fakePayload);
    const responseList = await snApp.listSettings();
    expect(responseList).to.eql({ [fakeSetting]: fakePayload });
  });

  it('creates and deletes a setting', async function () {
    await snApp.updateSetting(fakeSetting, fakePayload);
    const responseCreate = await snApp.getSetting(fakeSetting);
    expect(responseCreate).to.eql(fakePayload);

    await snApp.deleteSetting(fakeSetting);
    const responseDeleted = await snApp.listSettings();
    expect(responseDeleted).to.eql({});
  });

  it('creates and updates a setting', async function () {
    await snApp.updateSetting(fakeSetting, fakePayload);
    await snApp.updateSetting(fakeSetting, updatedFakePayload);
    const responseUpdated = await snApp.getSetting(fakeSetting);
    expect(responseUpdated).to.eql(updatedFakePayload);
  });

  it('reads a nonexistent setting', async () => {
    const setting = await snApp.getSetting(fakeSetting);
    expect(setting).to.equal(null);
  });

  it('reads a nonexistent sensitive setting', async () => {
    const setting = await snApp.getSensitiveSetting(SettingName.MfaSecret);
    expect(setting).to.equal(false);
  });

  it('creates and reads a sensitive setting', async () => {
    await snApp.updateSetting(SettingName.MfaSecret, 'fake_secret', true);
    const setting = await snApp.getSensitiveSetting(SettingName.MfaSecret);
    expect(setting).to.equal(true);
  });

  it('creates and lists a sensitive setting', async () => {
    await snApp.updateSetting(SettingName.MfaSecret, 'fake_secret', true);
    await snApp.updateSetting('UNSENSITIVE', 'so_unsensitive');
    const settings = await snApp.listSettings();
    expect(settings).to.eql({ UNSENSITIVE: 'so_unsensitive' });
  });
});