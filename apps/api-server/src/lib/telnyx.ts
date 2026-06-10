import { Telnyx } from "telnyx";

const telnyx = process.env.TELNYX_API_KEY
  ? new Telnyx({ apiKey: process.env.TELNYX_API_KEY })
  : null;

export async function purchaseGermanPhoneNumber(): Promise<string | null> {
  if (!telnyx || !process.env.TELNYX_CONNECTION_ID) {
    console.warn("Telnyx not configured — skipping phone number purchase");
    return null;
  }

  try {
    const { data: available } = await (telnyx.availablePhoneNumbers as any).list({
      filter: {
        country_code: "DE",
        features: ["voice"],
        limit: 3,
      },
    });

    if (!available?.length) {
      console.error("No German phone numbers available");
      return null;
    }

    const { data: order } = await (telnyx.numberOrders as any).create({
      phone_numbers: [{ phone_number: available[0].phone_number }],
      connection_id: process.env.TELNYX_CONNECTION_ID,
    });

    return order?.phone_numbers?.[0]?.phone_number ?? null;
  } catch (err) {
    console.error("Failed to purchase Telnyx number:", err);
    return null;
  }
}

export async function sendSMS(to: string, message: string): Promise<boolean> {
  if (!telnyx || !process.env.TELNYX_SENDER_NUMBER) {
    console.warn("Telnyx not configured — SMS not sent");
    return false;
  }

  try {
    await (telnyx.messages as any).create({
      from: process.env.TELNYX_SENDER_NUMBER,
      to,
      text: message,
    });
    return true;
  } catch (err) {
    console.error("SMS send failed:", err);
    return false;
  }
}

export async function releasePhoneNumber(phoneNumber: string): Promise<void> {
  if (!telnyx) return;
  try {
    await (telnyx.phoneNumbers as any).delete({ phone_number: phoneNumber });
    console.log(`Released Telnyx number: ${phoneNumber}`);
  } catch (err) {
    console.error(`Failed to release Telnyx number ${phoneNumber}:`, err);
  }
}
