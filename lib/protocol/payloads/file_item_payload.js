import * as fields from '@Payloads/fields';
import { SNPureItemPayload } from '@Payloads/pure_item_payload';

export class SNFileItemPayload extends SNPureItemPayload {
  static fields() {
    return [
      fields.ITEM_PAYLOAD_UUID,
      fields.ITEM_PAYLOAD_CONTENT_TYPE,
      fields.ITEM_PAYLOAD_ITEMS_KEY_ID,
      fields.ITEM_PAYLOAD_ENC_ITEM_KEY,
      fields.ITEM_PAYLOAD_CONTENT,
      fields.ITEM_PAYLOAD_CREATED_AT,
      fields.ITEM_PAYLOAD_UPDATED_AT,
      fields.ITEM_PAYLOAD_LEGACY_003_AUTH_HASH
    ]
  }
}