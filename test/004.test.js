/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
import * as Factory from './lib/factory.js';
chai.use(chaiAsPromised);
const expect = chai.expect;

describe('004 protocol operations', () => {
  const _identifier = 'hello@test.com';
  const _password = 'password';
  let _keyParams;
  let _key;

  const application = Factory.createApplication();
  const protocol004 = new SNProtocolOperator004(new SNWebCrypto());

  before(async () => {
    await Factory.initializeApplication(application);
    _key = await protocol004.createRootKey(
      _identifier,
      _password,
      KeyParamsOrigination.Registration
    );
    _keyParams = _key.keyParams;
  });

  after(() => {
    application.deinit();
  });

  it('cost minimum should throw', () => {
    expect(() => {application.protocolService.costMinimumForVersion('004')})
      .to.throw('Cost minimums only apply to versions <= 002');
  });

  it('generates valid keys for registration', async () => {
    const key = await application.protocolService.createRootKey(
      _identifier,
      _password,
      KeyParamsOrigination.Registration
    );

    expect(key.masterKey).to.be.ok;

    expect(key.serverPassword).to.be.ok;
    expect(key.mk).to.not.be.ok;
    expect(key.dataAuthenticationKey).to.not.be.ok;

    expect(key.keyParams.content004.pw_nonce).to.be.ok;
    expect(key.keyParams.content004.pw_cost).to.not.be.ok;
    expect(key.keyParams.content004.salt).to.not.be.ok;
    expect(key.keyParams.content004.identifier).to.be.ok;
  });

  it('computes proper keys for sign in', async () => {
    const identifier = 'foo@bar.com';
    const password = 'very_secure';
    const keyParams = application.protocolService.createKeyParams({
      pw_nonce: 'baaec0131d677cf993381367eb082fe377cefe70118c1699cb9b38f0bc850e7b',
      identifier: identifier,
      version: '004'
    });
    const key = await protocol004.computeRootKey(
      password,
      keyParams,
    );
    expect(key.masterKey).to.equal('5d68e78b56d454e32e1f5dbf4c4e7cf25d74dc1efc942e7c9dfce572c1f3b943');
    expect(key.serverPassword).to.equal('83707dfc837b3fe52b317be367d3ed8e14e903b2902760884fd0246a77c2299d');
    expect(key.dataAuthenticationKey).to.not.be.ok;
  });

  it('generates random key', async () => {
    const length = 96;
    const key = await application.protocolService.crypto.generateRandomKey(length);
    expect(key.length).to.equal(length/4);
  });

  it('properly encrypts and decrypts', async () => {
    const text = 'hello world';
    const rawKey = _key.masterKey;
    const nonce = await application.protocolService.crypto.generateRandomKey(192);
    const operator = application.protocolService.operatorForVersion(ProtocolVersion.V004);
    const additionalData = {foo: 'bar'};
    const encString = await operator.encryptString004(
      text,
      rawKey,
      nonce,
      await operator.attachedDataStringRepresentation(additionalData)
    );
    const decString = await operator.decryptString004(
      encString,
      rawKey,
      nonce,
      await operator.attachedDataStringRepresentation(additionalData)
    );
    expect(decString).to.equal(text);
  });

  it('fails to decrypt non-matching aad', async () => {
    const text = 'hello world';
    const rawKey = _key.masterKey;
    const nonce = await application.protocolService.crypto.generateRandomKey(192);
    const operator = application.protocolService.operatorForVersion(ProtocolVersion.V004);
    const aad = {foo: 'bar'};
    const nonmatchingAad = {foo: 'rab'};
    const encString = await operator.encryptString004(
      text,
      rawKey,
      nonce,
      await operator.attachedDataStringRepresentation(aad)
    );
    const decString = await operator.decryptString004(
      encString,
      rawKey,
      nonce,
      await operator.attachedDataStringRepresentation(nonmatchingAad)
    );
    expect(decString).to.not.be.ok;
  });

  it('generates existing keys for key params', async () => {
    const key = await application.protocolService.computeRootKey(
      _password,
      _keyParams
    );
    expect(key.compare(_key)).to.be.true;
  });

  it('can decrypt encrypted params', async () => {
    const payload = Factory.createNotePayload();
    const key = await protocol004.createItemsKey();
    const params = await protocol004.generateEncryptedParameters(
      payload,
      PayloadFormat.EncryptedString,
      key,
    );
    const decrypted = await protocol004.generateDecryptedParameters(
      params,
      key
    );
    expect(decrypted.errorDecrypted).to.not.be.ok;
    expect(decrypted.content).to.eql(payload.content);
  });
});
