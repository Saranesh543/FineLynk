#ifndef ALERTS_H
#define ALERTS_H

// ESP32 GPIO numbers.
#define GREEN_LED 25
#define RED_LED   26
#define BUZZER    14

// ---------------------------------------------------------
// BUZZER TYPE - set this to match your hardware.
//
//   0 = ACTIVE buzzer  (has its own oscillator inside).
//       Sounds whenever it gets voltage. digitalWrite is enough.
//
//   1 = PASSIVE buzzer (just a speaker coil, no oscillator).
//       Needs a square wave. digitalWrite HIGH gives ONE click
//       then silence - which looks exactly like "buzzer dead".
//
// If yours is silent on 0, change it to 1 and re-flash.
// Rule of thumb: active buzzers are usually sealed with a sticker
// on top; passive ones show the exposed coil underneath.
// ---------------------------------------------------------
#define BUZZER_PASSIVE 0
#define BUZZER_TONE_HZ 2400

// Alert pattern timing
#define ALERT_BLINK_MS 300     // red LED on/off period
#define BEEP_ON_MS     250     // buzzer on time
#define BEEP_OFF_MS    250     // buzzer silent time

bool alertState = false;

// ---------------------------------------------------------
// Low-level buzzer control, so the rest of the file doesn't care
// which type is fitted.
// ---------------------------------------------------------
void buzzerOn() {
#if BUZZER_PASSIVE
  tone(BUZZER, BUZZER_TONE_HZ);
#else
  digitalWrite(BUZZER, HIGH);
#endif
}

void buzzerOff() {
#if BUZZER_PASSIVE
  noTone(BUZZER);
#else
  digitalWrite(BUZZER, LOW);
#endif
}

void setupAlerts() {

  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER, OUTPUT);

  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RED_LED, LOW);
  buzzerOff();

  // ---------------------------------------------------------
  // Boot self-test. Proves the LED and buzzer wiring works
  // BEFORE you rely on it in a demo. If you see nothing here,
  // the problem is wiring or buzzer type - not the alert logic.
  // ---------------------------------------------------------
  Serial.println("Alert self-test: red LED + buzzer...");
  for (int i = 0; i < 2; i++) {
    digitalWrite(RED_LED, HIGH);
    buzzerOn();
    delay(150);
    digitalWrite(RED_LED, LOW);
    buzzerOff();
    delay(150);
  }
  Serial.println("Self-test done. Saw a flash and heard a beep? Wiring is good.");

  digitalWrite(GREEN_LED, HIGH);   // Master online
}

// Called once on a false->true transition.
void triggerAlert() {

  alertState = true;

  Serial.println("================================");
  Serial.println("ALERT ACTIVATED");
  Serial.println("================================");
}

// Called once on a true->false transition.
void clearAlert() {

  alertState = false;

  digitalWrite(RED_LED, LOW);
  buzzerOff();

  Serial.println("Alert Cleared");
}

// ---------------------------------------------------------
// Drives the actual alert pattern. Must be called every loop().
// Non-blocking - no delay(), so the web server keeps serving and
// ESP-NOW keeps receiving while the alarm runs.
//
//   Alert active -> red LED blinks, buzzer beeps intermittently
//   Alert clear  -> red LED off, buzzer silent
//
// An intermittent beep is used rather than a constant tone: it
// carries further, is far more recognisable as an alarm, and does
// not fatigue the ear during a long demo.
// ---------------------------------------------------------
void updateAlert() {

  static unsigned long lastBlink = 0;
  static unsigned long lastBeep  = 0;
  static bool ledOn  = false;
  static bool beepOn = false;

  if (!alertState) return;   // clearAlert() already turned things off

  // Blink the red LED
  if (millis() - lastBlink >= ALERT_BLINK_MS) {
    lastBlink = millis();
    ledOn = !ledOn;
    digitalWrite(RED_LED, ledOn);
  }

  // Pulse the buzzer
  unsigned long beepInterval = beepOn ? BEEP_ON_MS : BEEP_OFF_MS;
  if (millis() - lastBeep >= beepInterval) {
    lastBeep = millis();
    beepOn = !beepOn;
    if (beepOn) buzzerOn(); else buzzerOff();
  }
}

void beep(int times) {

  for (int i = 0; i < times; i++) {
    buzzerOn();
    delay(200);
    buzzerOff();
    delay(200);
  }
}

#endif
