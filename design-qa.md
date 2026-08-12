**Design QA**

- Source visual truth: `/Users/xn/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_is74gmsol2pn22_2607/msg/file/2026-08/IMG_7131.PNG`
- Desktop implementation: `/Users/xn/深情.club/qa/implementation-desktop.png`
- Mobile implementation: `/Users/xn/深情.club/qa/implementation-mobile.png`
- Combined comparison: `/Users/xn/深情.club/qa/comparison-desktop.png`
- Viewports: desktop 1254 x 900 CSS px at density 1; mobile 390 x 844 CSS px at density 1
- Source pixels: 1254 x 1254, normalized to 900 x 900 for the desktop comparison
- Implementation pixels: desktop 1254 x 900; mobile 390 x 844
- State: closed login cover, plus interactive register and recovery open-book states

**Full-View Evidence**

The final login cover keeps the source composition: centered orange hardcover on white, visible left spine, dark Chinese title, short underline, generous central breathing room, underline fields, outlined open button, and two lower links. The source is brighter and taller in its square canvas; the implementation intentionally uses a 5:7 book proportion so the form remains coordinated across desktop and mobile.

**Focused Evidence**

Focused browser captures verified the open registration and recovery pages. The generated cover texture and paper texture remain sharp at both tested densities. Typography, fields, Turnstile, messages, and submit controls stay within the page bounds. No extra focused crop was needed because all key controls remained legible in the 1254 x 900 and 390 x 844 full-state captures.

**Required Fidelity Surfaces**

- Fonts and typography: Kaiti-style display hierarchy follows the handwritten Chinese reference; Songti and system sans fallbacks preserve legibility. Letter spacing is zero except for deliberately spaced small labels.
- Spacing and layout: cover content follows the reference's vertical sequence. Desktop opens to a balanced two-page spread; mobile centers one page while the cover exits left.
- Colors and tokens: warm safety orange, dark brown-black ink, white room, and ivory inner paper match the reference direction and maintain readable contrast.
- Image quality: both cover and paper are real generated raster assets at 1400 x 1400 source resolution, compressed to JPEG without visible blocking at the rendered sizes.
- Copy and content: login wording matches the source. Registration and password-recovery copy is concise and consistent with the existing authentication behavior.

**Comparison History**

- Pass 1: P2, registration submit control extended below the desktop book page. Fixed by increasing the desktop page height and tightening registration spacing. Post-fix screenshot confirms the button ends 37 px above the page bottom.
- Pass 2: P1, mobile closed cover inherited the double-page offset and was clipped on the right. Fixed with a dedicated single-page centering transform below 960 px. Post-fix screenshot confirms a centered 343 px cover with no document overflow.
- Pass 3: P2, mobile registration content exceeded the restored 5:7 book ratio. Fixed with compact mobile form rhythm and bounded panel scrolling. Post-fix browser metrics report zero panel overflow and the submit button fully inside the page.

**Interaction Checks**

- Register link opens the book leftward and reveals the registration page.
- Recovery link opens the book leftward and reveals the password page.
- Close-book action restores login state and keyboard focus.
- Cloudflare Turnstile renders in the registration page.
- Recovery submission returns the non-enumerating manual-reset guidance.
- Browser console: no warnings or errors in the tested states.

**Findings**

No actionable P0, P1, or P2 issues remain.

**Follow-up Polish**

- P3: The source title is a custom brush script. The implementation uses the closest reliable local Kaiti family to avoid an external font dependency.

final result: passed
