import { Router, type Request, type Response } from "express";

const router = Router();

const VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Lena", description: "Freundlich, warm" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", description: "Professionell, klar" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", description: "Sanft, vertrauensvoll" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", description: "Ruhig, kompetent" },
];

const PROMPT_TEMPLATES: Record<string, string> = {
  booking: `Du bist eine freundliche KI-Telefonassistentin. Dein Name ist Lena.

AUFGABE:
Nimm Terminanfragen entgegen und buche Termine direkt ins Kalendersystem.

GESPRÄCHSFÜHRUNG:
- Sprich immer Deutsch, professionell und warmherzig
- Halte Antworten kurz (max. 2 Sätze)
- Frage nur EINE Sache auf einmal
- Bestätige wichtige Angaben durch Wiederholen

PFLICHTINFORMATIONEN:
1. Gewünschte Behandlung/Service
2. Wunschdatum und -uhrzeit
3. Vollständiger Name des Kunden
4. Rückrufnummer für Bestätigung`,
  advisory: `Du bist eine professionelle KI-Beratungsassistentin.

AUFGABE:
Beantworte Fragen, qualifiziere Leads und leite komplexe Anfragen weiter.

GESPRÄCHSFÜHRUNG:
- Professionell, kompetent und vertrauenswürdig
- Stelle klärende Fragen um den Bedarf zu verstehen
- Halte Antworten präzise und informativ`,
  hr_screening: `Du bist eine KI-Assistentin für HR-Erstgespräche.

AUFGABE:
Führe strukturierte Erstgespräche mit Kandidaten.

GESPRÄCHSFÜHRUNG:
- Freundlich und professionell
- Stelle eine Frage nach der anderen
- Bestätige und fasse Antworten zusammen`,
  hr_onboarding: `Du bist eine digitale Onboarding-Assistentin.

AUFGABE:
Beantworte Fragen neuer Mitarbeiter zu Einarbeitung und Abläufen.

GESPRÄCHSFÜHRUNG:
- Hilfsbereit und geduldig
- Erkläre Prozesse klar und verständlich`,
};

router.get("/voices", (_req: Request, res: Response) => {
  res.json(VOICES);
});

router.get("/prompts", (req: Request, res: Response) => {
  const type = req.query.type as string | undefined;
  if (type && PROMPT_TEMPLATES[type]) {
    res.json({ type, prompt: PROMPT_TEMPLATES[type] });
    return;
  }
  res.json(PROMPT_TEMPLATES);
});

export default router;
