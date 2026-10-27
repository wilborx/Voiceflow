import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface BookingEmailProps {
  brand: string;
  accent: string;
  preview: string;
  heading: string;
  paragraphs: string[];
  details?: { label: string; value: string }[];
  cta?: { label: string; href: string };
  secondaryLinks?: { label: string; href: string }[];
  footer: string;
}

/** Ein Layout für alle Kundennachrichten – dunkel, klar, ein Akzent. */
export function BookingEmail(p: BookingEmailProps) {
  return (
    <Html lang="de">
      <Head />
      <Preview>{p.preview}</Preview>
      <Body style={{ backgroundColor: "#0b0b0c", fontFamily: "Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" }}>
        <Container style={{ backgroundColor: "#141416", borderRadius: 12, maxWidth: 560, padding: "32px 28px", color: "#f4f4f5" }}>
          <Text style={{ color: p.accent, fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>
            {p.brand}
          </Text>
          <Heading as="h1" style={{ fontSize: 24, lineHeight: "30px", margin: "12px 0 20px", color: "#ffffff" }}>
            {p.heading}
          </Heading>
          {p.paragraphs.map((t, i) => (
            <Text key={i} style={{ fontSize: 15, lineHeight: "24px", color: "#d4d4d8", margin: "0 0 14px" }}>
              {t}
            </Text>
          ))}
          {p.details && p.details.length > 0 && (
            <Section style={{ backgroundColor: "#1c1c1f", borderRadius: 8, padding: "16px 18px", margin: "18px 0" }}>
              {p.details.map((d) => (
                <Text key={d.label} style={{ margin: "4px 0", fontSize: 14, color: "#e4e4e7" }}>
                  <span style={{ color: "#a1a1aa" }}>{d.label}: </span>
                  {d.value}
                </Text>
              ))}
            </Section>
          )}
          {p.cta && (
            <Button
              href={p.cta.href}
              style={{ backgroundColor: p.accent, color: "#ffffff", fontWeight: 700, fontSize: 15, borderRadius: 8, padding: "14px 22px", display: "inline-block", margin: "8px 0 4px" }}
            >
              {p.cta.label}
            </Button>
          )}
          {p.secondaryLinks?.map((l) => (
            <Text key={l.href} style={{ margin: "10px 0 0", fontSize: 14 }}>
              <Link href={l.href} style={{ color: p.accent }}>
                {l.label}
              </Link>
            </Text>
          ))}
          <Hr style={{ borderColor: "#27272a", margin: "28px 0 16px" }} />
          <Text style={{ fontSize: 12, lineHeight: "18px", color: "#71717a", margin: 0 }}>{p.footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}
