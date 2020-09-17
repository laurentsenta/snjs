import { ContentType } from '@Models/content_types';
import {
  ItemsKeyAttachedData,
  NonItemsKeyAttachedData,
  AttachedData,
  GenericAttachedData
} from '@Payloads/generator';
import { UuidString } from './../../../types';
import { SNItemsKey } from '@Models/app/items_key';
import { PurePayload } from './../../payloads/pure_payload';
import { Create004KeyParams, SNRootKeyParams, KeyParamsOrigination } from './../../key_params';
import { V004Algorithm } from './../algorithms';
import { ItemsKeyContent } from './../operator';
import { SNProtocolOperator003 } from '@Protocol/operator/003/operator_003';
import { PayloadFormat } from '@Payloads/formats';
import { CreateEncryptionParameters, CopyEncryptionParameters } from '@Payloads/generator';
import { ProtocolVersion } from '@Protocol/versions';
import { SNRootKey } from '@Protocol/root_key';
import { truncateHexString, sortedCopy } from '@Lib/utils';
import { ContentTypeUsesRootKeyEncryption } from '@Lib/protocol/intents';

const PARTITION_CHARACTER = ':';

export class SNProtocolOperator004 extends SNProtocolOperator003 {

  public getEncryptionDisplayName(): string {
    return 'XChaCha20-Poly1305';
  }

  get version() {
    return ProtocolVersion.V004;
  }

  protected async generateNewItemsKeyContent() {
    const itemsKey = await this.crypto.generateRandomKey(V004Algorithm.EncryptionKeyLength);
    const response: ItemsKeyContent = {
      itemsKey: itemsKey,
      version: ProtocolVersion.V004
    }
    return response;
  }

  /**
   * We require both a client-side component and a server-side component in generating a
   * salt. This way, a comprimised server cannot benefit from sending the same seed value
   * for every user. We mix a client-controlled value that is globally unique
   * (their identifier), with a server controlled value to produce a salt for our KDF.
   * @param identifier
   * @param seed
  */
  private async generateSalt004(identifier: string, seed: string) {
    const hash = await this.crypto.sha256([identifier, seed].join(PARTITION_CHARACTER));
    return truncateHexString(hash, V004Algorithm.ArgonSaltLength);
  }

  /**
   * Computes a root key given a passworf
   * qwd and previous keyParams
   * @param password - Plain string representing raw user password
   * @param keyParams - KeyParams object
   */
  public async computeRootKey(password: string, keyParams: SNRootKeyParams) {
    return this.deriveKey(password, keyParams);
  }

  /**
   * Creates a new root key given an identifier and a user password
   * @param identifier - Plain string representing a unique identifier
   * @param password - Plain string representing raw user password
   */
  public async createRootKey(
    identifier: string,
    password: string,
    origination: KeyParamsOrigination
  ) {
    const version = ProtocolVersion.V004;
    const seed = await this.crypto.generateRandomKey(V004Algorithm.ArgonSaltSeedLength);
    const keyParams = Create004KeyParams({
      identifier: identifier,
      pw_nonce: seed,
      version: version,
      origination: origination,
      created: `${Date.now()}`
    });
    return this.deriveKey(
      password,
      keyParams
    );
  }

  /**
   * @param plaintext - The plaintext to encrypt.
   * @param rawKey - The key to use to encrypt the plaintext.
   * @param nonce - The nonce for encryption.
   * @param attachedData - JavaScript object (will be stringified) representing
                'Additional authenticated data': data you want to be included in authentication.
   */
  private async encryptString004(plaintext: string, rawKey: string, nonce: string, attachedData: string) {
    if (!nonce) {
      throw 'encryptString null nonce';
    }
    if (!rawKey) {
      throw 'encryptString null rawKey';
    }
    return this.crypto.xchacha20Encrypt(plaintext, nonce, rawKey, attachedData);
  }

  /**
   * @param {string} ciphertext  The encrypted text to decrypt.
   * @param {string} rawKey  The key to use to decrypt the ciphertext.
   * @param {string} nonce  The nonce for decryption.
   * @param {object} attachedData  JavaScript object (will be stringified) representing
                'Additional authenticated data' - data you want to be included in authentication.
   */
  private async decryptString004(ciphertext: string, rawKey: string, nonce: string, attachedData: string) {
    return this.crypto.xchacha20Decrypt(ciphertext, nonce, rawKey, attachedData);
  }

  /**
   * @param plaintext  The plaintext text to decrypt.
   * @param rawKey  The key to use to encrypt the plaintext.
   * @param itemUuid  The uuid of the item being encrypted
   */
  private async generateEncryptedProtocolString(
    plaintext: string,
    rawKey: string,
    attachedData: string
  ) {
    const nonce = await this.crypto.generateRandomKey(V004Algorithm.EncryptionNonceLength);
    const version = ProtocolVersion.V004;
    const ciphertext = await this.encryptString004(
      plaintext,
      rawKey,
      nonce,
      attachedData
    );
    const payload = [version, nonce, ciphertext, attachedData].join(PARTITION_CHARACTER);
    return payload;
  }

  private generateAttachedDataForPayload(
    payloadUuid: UuidString,
    payloadVersion: ProtocolVersion,
    contentType: ContentType,
    key: SNItemsKey | SNRootKey,
  ): ItemsKeyAttachedData | NonItemsKeyAttachedData {
    const baseData: GenericAttachedData = {
      u: payloadUuid,
      v: payloadVersion,
    }
    if (ContentTypeUsesRootKeyEncryption(contentType)) {
      const itemsKeyData: ItemsKeyAttachedData = {
        ...baseData,
        kp: sortedCopy((key as SNRootKey).keyParams.content)
      };
      return itemsKeyData;
    } else {
      if (!(key instanceof SNItemsKey)) {
        throw Error('Attempting to use non-items key for regular item');
      }
      const nonItemsKeyData: NonItemsKeyAttachedData = {
        ...baseData,
      };
      return nonItemsKeyData;
    }
  }

  private async attachedDataStringRepresentation(attachedData: AttachedData) {
    return this.crypto.base64Encode(JSON.stringify(sortedCopy(attachedData)));
  }

  public async generateEncryptedParameters(
    payload: PurePayload,
    format: PayloadFormat,
    key?: SNItemsKey | SNRootKey,
  ) {
    if ((
      format === PayloadFormat.DecryptedBareObject ||
      format === PayloadFormat.DecryptedBase64String
    )) {
      return super.generateEncryptedParameters(payload, format, key);
    }
    if (format !== PayloadFormat.EncryptedString) {
      throw `Unsupport format for generateEncryptedParameters ${format}`;
    }
    if (!payload.uuid) {
      throw 'payload.uuid cannot be null';
    }
    if (!key || !key.itemsKey) {
      throw 'Attempting to generateEncryptedParameters with no itemsKey.';
    }
    const itemKey = await this.crypto.generateRandomKey(V004Algorithm.EncryptionKeyLength);
    /** Encrypt content with item_key */
    const contentPlaintext = JSON.stringify(payload.content);
    const attachedData = this.generateAttachedDataForPayload(
      payload.uuid, ProtocolVersion.V004, payload.content_type, key
    );
    const attachedDataString = await this.attachedDataStringRepresentation(attachedData);
    const encryptedContentString = await this.generateEncryptedProtocolString(
      contentPlaintext,
      itemKey,
      attachedDataString
    );
    /** Encrypt item_key with master itemEncryptionKey */
    const encryptedItemKey = await this.generateEncryptedProtocolString(
      itemKey,
      key.itemsKey,
      attachedDataString
    );
    return CreateEncryptionParameters(
      {
        uuid: payload.uuid,
        items_key_id: key instanceof SNItemsKey ? key.uuid : undefined,
        content: encryptedContentString,
        enc_item_key: encryptedItemKey
      }
    );
  }

  public async generateDecryptedParameters(
    payload: PurePayload,
    key?: SNItemsKey | SNRootKey
  ) {
    const format = payload.format;
    if ((
      format === PayloadFormat.DecryptedBareObject ||
      format === PayloadFormat.DecryptedBase64String
    )) {
      return super.generateDecryptedParameters(payload, key);
    }
    if (!payload.uuid) {
      throw 'encryptedParameters.uuid cannot be null';
    }
    if (!key || !key.itemsKey) {
      throw 'Attempting to generateDecryptedParameters with no itemsKey.';
    }
    /** Decrypt item_key payload. */
    const itemKeyComponents = this.deconstructEncryptedPayloadString(
      payload.enc_item_key!
    );
    /**
     * Rebuild our own version of the attached data string using what we know to be correct
     * The generated result must match what is stored inside the encrypted payload components
     * in order to decrypt properly
     */
    const attachedData = this.generateAttachedDataForPayload(
      payload.uuid,
      payload.version!,
      payload.content_type,
      key
    );
    const attachedDataString = await this.attachedDataStringRepresentation(attachedData);
    const itemKey = await this.decryptString004(
      itemKeyComponents.ciphertext,
      key.itemsKey,
      itemKeyComponents.nonce,
      attachedDataString
    );
    if (!itemKey) {
      console.error('Error decrypting itemKey parameters', payload);
      return CopyEncryptionParameters(
        payload,
        {
          errorDecrypting: true,
          errorDecryptingValueChanged: !payload.errorDecrypting,
        }
      );
    }
    /** Decrypt content payload. */
    const contentComponents = this.deconstructEncryptedPayloadString(
      payload.contentString
    );
    const content = await this.decryptString004(
      contentComponents.ciphertext,
      itemKey,
      contentComponents.nonce,
      attachedDataString
    );
    if (!content) {
      return CopyEncryptionParameters(
        payload,
        {
          errorDecrypting: true,
          errorDecryptingValueChanged: !payload.errorDecrypting,
        }
      );
    } else {
      return CopyEncryptionParameters(
        payload,
        {
          content: JSON.parse(content),
          items_key_id: undefined,
          enc_item_key: undefined,
          errorDecrypting: false,
          errorDecryptingValueChanged: payload.errorDecrypting === true,
          waitingForKey: false,
        }
      );
    }
  }

  private deconstructEncryptedPayloadString(payloadString: string) {
    const components = payloadString.split(PARTITION_CHARACTER);
    return {
      version: components[0],
      nonce: components[1],
      ciphertext: components[2],
      rawAttachedData: components[3]
    };
  }

  protected async deriveKey(password: string, keyParams: SNRootKeyParams) {
    const salt = await this.generateSalt004(
      keyParams.content004.identifier,
      keyParams.content004.pw_nonce
    );
    const derivedKey = await this.crypto.argon2(
      password,
      salt,
      V004Algorithm.ArgonIterations,
      V004Algorithm.ArgonMemLimit,
      V004Algorithm.ArgonOutputKeyBytes
    );
    const partitions = this.splitKey(derivedKey, 2);
    const masterKey = partitions[0];
    const serverPassword = partitions[1];
    return SNRootKey.Create(
      {
        masterKey,
        serverPassword,
        version: ProtocolVersion.V004,
        keyParams: keyParams.getPortableValue()
      }
    );
  }
}
