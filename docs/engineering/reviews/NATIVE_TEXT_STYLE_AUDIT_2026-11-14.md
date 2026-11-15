# Native text style audit · 2026-11-14

User target for ordinary descriptive copy: Baloo 2 Medium,18pt,#CF9373,
23.4pt line height. Existing tablet projection/scaling remains authoritative.
All runtime brown UI text now uses one NativeTextPalette.brown value; navigation,
modalTitle and subtitle are semantic aliases. Orange accents remain authored.

| Surface | Discrepancy found | Final change |
| --- | --- | --- |
| Story body | 17pt Medium,#AD8675,23.8pt leading | Shared18pt Medium/#CF9373/23.4pt; matches Special die descriptions |
| Story Fun fact body | 17pt Medium,#AD8675,23.8pt leading |18pt Medium/#CF9373/23.4pt;18pt Bold orange prefix retained |
| Privacy Policy body |17pt Medium,22.5pt leading and separate dark ink |18pt Medium/#CF9373/23.4pt;left alignment and paragraph gaps preserved |
| Score modal stat captions |18pt Regular |18pt Medium with shared subtitle paragraph style |
| Journey Stage stat captions |18pt Regular |18pt Medium with shared subtitle paragraph style |
| DEV tools summary |18pt default Bold overrode initial Medium |Explicit18pt Medium |
| Navigation/modal titles,paper prompts,Stage/Endurance HUD |#BE7C59 and other independent brown values |Shared#CF9373;existing font sizes/weights retained |
| Settings/private policy/DEV,secondary CTA,intro brand,HUD values |Independent brown values |Shared brown,retaining intentional opacity |

Typography is role-specific. These are intentional exceptions,not ordinary
body paragraphs:17pt ExtraBold paper prompts and round badge;14–16pt metadata
and footer/date/copyright;large ExtraBold titles;large20–32pt SemiBold reward/
tutorial-completion announcements;white CTA text and red debug error text.
The only remaining17pt Medium runtime label found is the red migration error,
not a brown product description. An unused private NativeBackpackCellPalette
still contains historical dark ink but has no call sites or runtime text use.
No literal Tap to open label was located in Native source;the actual paper
prompts found are Drag to flip,Tap to collect and tutorial delivery labels.
Artwork,shadows,dice glyph rendering and original assets were not recolored.

Runtime ownership is unchanged. No new observer,timer,renderer,cache or audio.
Shared Story idle remains. Final illustration offset is14pt right;copy-to-image gap34pt. TextKit inline Star now
clamps its18pt frame within the label after the tighter line height exposed a
subpoint negative vertical bound. Animation atlas/timing remain unchanged.

Validation:final fast/iOS gates PASS;focused mounted Native suite8/0 PASS16.528s,
including Story and Privacy typography at320/390/820,Story lifecycle/retirement,
CTA and tablet round-label layout. Normal Debug BUILD SUCCEEDED. Logs:
/tmp/native-fact-tilt-{fast,ios,tests,build,full}.log.

Broader selected Native geometry/material tests exposed pre-existing expectation
mismatches outside this edit:Stage close centre42vs36;Privacy paper now uses
rounded/joined material while test expects unclipped legacy paper;Score history
expects old340-square fitted texture while current source retains1170x1632 paper.
These are not converted to passing tests by weakening assertions or changing
unrelated geometry. Evidence:/tmp/native-brown-tests.log and
/tmp/native-typography-final-tests.log. Current scoped typography checks are
separate from those failures and physical optical acceptance.

Final Story finish:Fun fact background alpha1 with an opaque cream underlay
beneath the preserved paper texture. A single signed1.5–2.5degree rest tilt is
sampled at modal creation;the complete fact container inherits existing root
motion. Bounds/center layout avoids nonidentity-transform frame drift. Mounted
tests verify the local angle range,persistent pose,opaque background,34pt art
gap,14pt image offset and shared readable18pt/23.4pt fact text.

Final full QA retains only the protected web scene-builders.test.ts:75 failure
(529 suites/4010 tests pass);all other deterministic gates PASS. Final normal
Debug installed over both retained Simulators and both Story previews inspected.
Phone PID81443,iPad PID81495. Native bundle/binary/source freshness verified.
Physical optical acceptance remains separate.
