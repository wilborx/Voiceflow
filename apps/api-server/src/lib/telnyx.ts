import { Telnyx } from "telnyx";
import { logger } from "./logger.js";

const telnyxApiKey = process.env.TELNYX_API_KEY?.trim();
const telnyx = telnyxApiKey ? new Telnyx({ apiKey: telnyxApiKey }) : null;

type TelnyxClient = NonNullable<typeof telnyx>;

export async function purchaseGermanPhoneNumberWithClient(
  client: TelnyxClient,
  connectionId: string | undefined,
): Promise<string | null> {
  if (!connectionId) {
    logger.warn("Telnyx not configured - skipping phone number purchase");
    return null;
  }

  try {
    const { data: available } = await client.availablePhoneNumbers.list({
      filter: {
        country_code: "DE",
        features: ["voice"],
        limit: 3,
      },
    });

    if (!available?.length) {
      logger.error("No German phone numbers available");
      return null;
    }

    const phoneNumber = available[0]?.phone_number;
    if (!phoneNumber) {
      logger.error("No German phone numbers available");
      return null;
    }

    const { data: order } = await client.numberOrders.create({
      phone_numbers: [{ phone_number: phoneNumber }],
      connection_id: connectionId,
    });

    return order?.phone_numbers?.[0]?.phone_number ?? null;
  } catch (err) {
    logger.error({ err }, "Failed to purchase Telnyx number");
    return null;
  }
}

export async function purchaseGermanPhoneNumber(): Promise<string | null> {
  if (!telnyx || !process.env.TELNYX_CONNECTION_ID) {
    logger.warn("Telnyx not configured - skipping phone number purchase");
    return null;
  }

  return purchaseGermanPhoneNumberWithClient(
    telnyx,
    process.env.TELNYX_CONNECTION_ID,
  );
}

export async function sendSMSWithClient(
  client: TelnyxClient,
  to: string,
  message: string,
  senderNumber: string | undefined,
): Promise<boolean> {
  if (!senderNumber) {
    logger.warn("Telnyx not configured - SMS not sent");
    return false;
  }

  try {
    await client.messages.send({
      from: senderNumber,
      to,
      text: message,
    });
    return true;
  } catch (err) {
    logger.error({ err, to }, "SMS send failed");
    return false;
  }
}

export async function sendSMS(to: string, message: string): Promise<boolean> {
  if (!telnyx || !process.env.TELNYX_SENDER_NUMBER) {
    logger.warn("Telnyx not configured - SMS not sent");
    return false;
  }

  return sendSMSWithClient(
    telnyx,
    to,
    message,
    process.env.TELNYX_SENDER_NUMBER,
  );
}

export async function releasePhoneNumberWithClient(
  client: TelnyxClient,
  phoneNumber: string,
): Promise<void> {
  await client.phoneNumbers.delete(phoneNumber);
  logger.info({ phoneNumber }, "Released Telnyx number");
}

export async function releasePhoneNumber(phoneNumber: string): Promise<void> {
  if (!telnyx) return;
  try {
    await releasePhoneNumberWithClient(telnyx, phoneNumber);
  } catch (err) {
    logger.error({ err, phoneNumber }, "Failed to release Telnyx number");
  }
}
