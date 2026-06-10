# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

Wir nehmen Sicherheitslücken ernst. Wenn Sie eine Sicherheitslücke entdecken, melden Sie diese bitte vertraulich.

### Dringende Sicherheitslücken

Bei kritischen Sicherheitslücken kontaktieren Sie uns bitte direkt unter:
- E-Mail: security@voiceflow-ai.de
- Oder öffnen Sie ein Issue mit dem Label `security`

### Sicherheits-Checkliste

Wenn Sie Sicherheitsrelevante Änderungen beitragen:
- [ ] Keine Secrets/API-Keys in Code eingefügt
- [ ] Recording-Pfade sind geschützt
- [ ] PII-Daten werden ordnungsgemäß redigiert
- [ ] Authentifizierungsprüfungen vorhanden
- [ ] Rate Limiting implementiert (falls API-Endpunkt)
- [ ] Input Validation mit Zod durchgeführt

## DSGVO Security Requirements

Dieses Projekt verarbeitet personenbezogene Daten (Voice-Recordings). Beachten Sie:

1. **Verschlüsselung**: Alle Daten in-transit und at-rest müssen verschlüsselt sein
2. **Consent Management**: Recording-Zugriff nur nach ausdrücklichem Einwilligungsvermerk
3. **Audit Trail**: Alle Zugriffe auf PII müssen geloggt werden
4. **Auto-Löschung**: Recordings und zugehörige Daten nach definiertem Zeitraum automatisch löschen