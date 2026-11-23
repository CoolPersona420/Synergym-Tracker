import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs, weekPlan, firstOn, sessionMinutes, DEFAULT_DAYS } from '../../src/lib/ics.js';

const ppl = [{ i: 0, title: 'Push' }, { i: 1, title: 'Pull' }, { i: 2, title: 'Legs' }];

test('a split that lines up with the week names each day; one that rotates says Training', () => {
  const a = weekPlan(ppl, [4, 0, 2]);
  assert.equal(a.named, true);
  assert.deepEqual(a.rows.map(r => [r.wd, r.day.title]), [[0, 'Push'], [2, 'Pull'], [4, 'Legs']]);
  const b = weekPlan(ppl, [0, 3]);
  assert.equal(b.named, false);
  assert.deepEqual(b.rows.map(r => [r.wd, r.day]), [[0, null], [3, null]]);
  assert.deepEqual(DEFAULT_DAYS[3], [0, 2, 4]);
});

test('the first event is the next time that weekday comes round, today only if the time is still ahead', () => {
  const mon9 = new Date(2026, 10, 23, 9, 0); // Monday 23 Nov 2026, 09:00
  assert.equal(firstOn(0, '18:00', mon9).getDate(), 23);
  assert.equal(firstOn(0, '08:00', mon9).getDate(), 30);
  const wed = firstOn(2, '18:30', mon9);
  assert.deepEqual([wed.getDate(), wed.getHours(), wed.getMinutes()], [25, 18, 30]);
  assert.equal(firstOn(6, '07:00', mon9).getDate(), 29);
});

test('the file: weekly repeats, a reminder before, the link, local times and escaped text', () => {
  const ics = buildIcs({ time: '18:00', alarm: 30, now: new Date(2026, 10, 23, 9, 0),
    events: [{ wd: 2, title: 'Pull · Synergym', notes: 'Row, Pulldown; curls\nStart: https://x.app/go/s1/1', url: 'https://x.app/go/s1/1', uid: 's1-2@synergym', minutes: 60 }] });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.match(ics, /\r\nDTSTART:20261125T180000\r\n/);
  assert.match(ics, /\r\nRRULE:FREQ=WEEKLY;BYDAY=WE\r\n/);
  assert.match(ics, /\r\nDURATION:PT60M\r\n/);
  assert.match(ics, /\r\nURL:https:\/\/x.app\/go\/s1\/1\r\n/);
  assert.match(ics, /BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Pull · Synergym\r\nTRIGGER:-PT30M\r\nEND:VALARM/);
  assert.match(ics, /DESCRIPTION:Row\\, Pulldown\\; curls\\nStart: https/);
  assert.match(ics, /\r\nUID:s1-2@synergym\r\n/);
  assert.doesNotMatch(ics, /DTSTART:[0-9T]+Z/);
});

test('long lines fold at 75 bytes without breaking a character; no reminder when it is off', () => {
  const notes = 'Bench Press, Overhead Press, Incline Dumbbell Press, Triceps Pushdown, Lateral Raise — ünïcödé ' + 'x'.repeat(120);
  const ics = buildIcs({ time: '07:15', alarm: 0, now: new Date(2026, 10, 23, 9, 0), events: [{ wd: 0, title: 'Push', notes, uid: 'u', minutes: 75 }] });
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  const unfolded = ics.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('ünïcödé'));
  assert.doesNotMatch(ics, /VALARM/);
});

test('a session’s length from its sets', () => {
  assert.equal(sessionMinutes(12), 45);
  assert.equal(sessionMinutes(1), 30);
  assert.equal(sessionMinutes(80), 120);
});
