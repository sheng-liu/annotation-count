# Annotation Count for Zotero

A local-first Zotero 10 plugin for sorting papers by the annotation work you
have put into their PDFs.

The plugin adds four optional columns to Zotero's item list:

- **Marks** — all Zotero-indexed highlights, underlines, notes, drawings,
  images, and other annotations across a paper's file attachments.
- **Comments** — annotations whose comment field contains text you wrote.
- **Last Native Annotation** — the newest modification date among annotations
  created in Zotero. Embedded annotations are excluded because Zotero records
  their indexing time, not necessarily the time the mark was made.
- **ReadCube Records** — entries found in child notes tagged
  `readcube-annotations`, kept separate to avoid double-counting annotations
  that are also embedded in a PDF.

Counts on a bibliographic item are aggregated across all its file attachments.
Counts on an expanded attachment row apply only to that attachment.

## Embedded PDF annotations

Zotero-native annotations live in Zotero's database. Annotations created in
ReadCube, Preview, Acrobat, or another reader can instead remain embedded in
the PDF. They must be indexed before the columns can count them.

Choose **Tools → Index Embedded PDF Annotations…**. The command asks Zotero's
own PDF worker to create a local, read-only representation of embedded
annotations. It deliberately uses `transfer=false`:

- the PDF file is not rewritten;
- embedded annotations remain in the PDF;
- Zotero can search and count them;
- unchanged PDFs are skipped on later runs using Zotero's processed-file
  timestamp.

Errors are logged to Zotero's error console and summarized when the pass ends.

## Install

1. Download `annotation-count.xpi` from the
   [latest release](https://github.com/sheng-liu/annotation-count/releases/latest).
2. In Zotero, choose **Tools → Plugins**.
3. Use the gear menu and choose **Install Plugin From File…**.
4. Select the downloaded `annotation-count.xpi`.
5. Right-click the Zotero item-list header and enable the desired columns.

Zotero checks the repository's update manifest automatically for later
releases. No npm or command-line tools are needed to install the XPI.

## Development

```sh
npm ci
npm test
```

`npm test` runs focused parsing/sorting tests, type-checks the TypeScript, and
packages `build/annotation-count.xpi`.

The custom columns use Zotero's supported `ItemTreeManager.registerColumn`
API. Numeric values are internally zero-padded because Zotero compares custom
column values as strings; rendered cells still show ordinary numbers.

## Safety model

- The plugin never writes annotation content into a PDF.
- It never writes directly to `zotero.sqlite`.
- Embedded annotations are indexed through Zotero's own PDF worker.
- Migrated ReadCube note entries are shown in a separate column rather than
  added to PDF counts.
- Removing the plugin does not remove or alter any PDF.

## Attribution and license

This project began as a fork of
[Zotero Annotations Count](https://github.com/Dominic-DallOsto/zotero-annotations-count)
by Dominic Dall'Osto. See [NOTICE.md](NOTICE.md). It remains licensed under
GPL-3.0-or-later.
