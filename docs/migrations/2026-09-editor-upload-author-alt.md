# 2026-09 — the author's image alt wins over the uploader's; the upload status finishes

Applies to `@malva-ui/editor` (`MlvEditor` image uploads: `MlvEditorImageUploader`,
`MlvEditorImageUploadResult`, `MlvEditorImageUploadControl.start()`, the
upload dialog and the editor-level upload status). Fixes #448.

**Breaking, behaviour only.** No exported symbol was renamed, removed or
retyped; no selector, input, output, token, i18n key or BEM class changed.
What changes is what a value **means**: the `alt` and `title` an uploader
returns in `MlvEditorImageUploadResult` stop overriding the ones the author
supplied, and become a fallback.

`VERSIONING.md` § 3, row 112 (_Changed default behaviour at an unchanged API —
… what a value means_). The status half — the editor-level live region no
longer keeps a progress label after the upload ended — is row 117 (_Bug fix
that restores documented behaviour_: the status "reports progress", and a
finished upload has none). On the `0.x` line a `!` commit is demoted to a
minor: `0.1.15` → `0.2.0` (§ 7).

## 1. Alt and title precedence

The coordinator merged a result as
`alt = result.alt ?? author alt`, `title = result.title ?? author title`. The
upload dialog **requires** alternative text unless the image is marked
decorative — and then discarded it whenever the uploader returned an `alt`.
The docs adapter returns `alt: file.name`, so the dialog's required
"Alternative text" produced `alt="browser-smoke.png"`, and the editor e2e
"uploads one image through the docs adapter…" failed 3/3 on `main`.

Owner ruling (#448, audit decision accepted): the author states what the image
means, and WCAG 1.1.1 asks for alt text that describes it, which a file name
rarely does. Now:

| Author supplied (dialog / `start()` metadata)                       | Uploader returned                     | Before                             | After                                                |
| ------------------------------------------------------------------- | ------------------------------------- | ---------------------------------- | ---------------------------------------------------- |
| alt `'A mountain'`                                                  | alt `'photo.png'`                     | `alt="photo.png"`                  | **`alt="A mountain"`**                               |
| alt `''` (image marked decorative)                                  | alt `'photo.png'`, title `'IMG_2231'` | `alt="photo.png" title="IMG_2231"` | **`alt=""`, no title** — decorative stays decorative |
| alt `''` + title `'Sunrise'` (`start()` only; the dialog clears it) | no title                              | `alt="" title="Sunrise"`           | **`alt=""`, no title**                               |
| no alt (paste, drop)                                                | alt `'photo.png'`                     | `alt="photo.png"`                  | `alt="photo.png"` — unchanged                        |
| alt `'A mountain'`                                                  | no alt                                | `alt="A mountain"`                 | `alt="A mountain"` — unchanged                       |
| title `'Sunrise'`                                                   | title `'Upload'`                      | `title="Upload"`                   | **`title="Sunrise"`**                                |
| no title / `''`                                                     | title `'Upload'`                      | `title="Upload"`                   | `title="Upload"` — unchanged                         |
| title `''` (`start()` only; the dialog never sends it)              | no title                              | `title=""`                         | **no title**                                         |

The decorative row goes one step past the literal "the author's **non-empty**
alt wins": an empty alt is the only way the dialog can say "decorative", and
letting a file name replace it would turn an image the author marked as
conveying nothing into one announced by its file name.

A decorative image also keeps **no title** — neither the author's nor the
uploader's. Measured in Chrome 153 (CDP `Accessibility.getFullAXTree`):
`<img alt="">` is absent from the accessibility tree, while
`<img alt="" title="IMG_2231">` is a non-ignored `image` with an empty name
and the description "IMG_2231", so a screen reader meets an unlabelled image.
WCAG technique H67 asks for an empty alt **and** no `title` on an image
assistive technology should ignore. The upload dialog therefore disables its
"Image title" field while Decorative is on and clears the draft when
Decorative is turned on; turning it off again leaves the field empty. The
rule keys on the **author's** empty alt: an uploader's own `alt: ''` is
inserted as returned, title included, as it was before — return no `title`
for an image you mean to be decorative (WCAG H67).

Otherwise an empty _title_ means no title, so the uploader's still fills it,
and with no uploader title none is inserted. Title follows alt because the
dialog's "Image title" field was discarded by the same line; the ruling's
rationale (author intent) covers it.

`imageUploadSuccess`'s `result` is the metadata inserted into the document,
author values applied — the same object as before, now carrying the author's
alt / title where the uploader's used to be.

## 2. The upload status finishes

After a dialog upload succeeded, the editor-level status live region
(`.mlv-editor-image-upload-status__live`, visually hidden, exposed to assistive
technology) kept reading **"Uploading image: 70%"** for the rest of the page's
life. Nothing was dropped by the coordinator: the status deliberately leaves a
dialog-owned success to the dialog's own announcement (so it is not spoken
twice), but it never replaced or cleared the progress text it had written. The
docs adapter reports `100` and resolves in the same task; zoneless, the render
tick runs in a later macrotask while the upload's promise chain settles in
microtasks, so the upload had ended before the `100` bucket rendered and the
last bucket the status rendered was `70` (from `75`).

Now the status records which upload its text describes, and when that upload
ends without an announcement of its own — a dialog-owned success, a lifecycle
abort (the editor turning disabled / readonly), a removed failure — it clears.
Another upload's progress is left alone. The dialog, which stays open after a
failure is removed from it, clears its own "Image upload failed." the same
way. Measured in Chromium through the e2e: with the clear ablated the region
reads `"Uploading image: 70%"`; with it, `""`.

## 3. Consumer shapes

- **An uploader returning `alt` meant to override the user** (a DAM or an AI
  captioner whose text should win). There is no opt-out, deliberately. **Do:**
  let the user's text stand — for paste and drop, where nobody typed one,
  your `alt` still applies. Pre-filling the dialog from the uploader has no
  hook today.
- **A custom UI calling `start(files, source, { alt })` with `alt: ''` for
  "not typed".** `''` now means decorative and stays empty. **Do:** omit `alt`
  (or pass `undefined`) when the author typed nothing.
- **A custom UI calling `start(files, source, { alt: '', title })`**, or an
  uploader returning a `title` for images the user marks decorative. The
  title is dropped. **Do:** if the text conveys meaning, the image is not
  decorative — pass it as `alt`.
- **A spec typing an "Image title" and then turning Decorative on.** The
  field is now disabled and empty. **Do:** assert the inserted image has
  `alt=""` and no title.
- **A spec or listener reading `imageUploadSuccess.result.alt` / `.title`
  as the uploader's own value.** It is now the inserted value. **Do:** read the
  uploader's return value where you create it.
- **A spec asserting the status region's text after a dialog upload, a
  lifecycle abort or a removed failure.** It is now `''`. **Do:** assert the
  resolved text, or the dialog's announcement for a dialog-owned success.

## 4. Not changed

`width` / `height` / `src` handling, URL policy validation, the paste / drop
precedence (no author metadata — an uploader's own `alt: ''` is inserted as
returned, title included, so return no `title` for an image you mean to be
decorative), cancellation announcements ("Cancel upload"
stays in both regions), "Upload complete" for uploads with no live dialog
owner, and every i18n key.
