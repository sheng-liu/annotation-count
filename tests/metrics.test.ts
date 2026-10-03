import test from "node:test";
import assert from "node:assert/strict";
import {
	countReadCubeHeadings,
	displayNumericSortValue,
	hasWrittenComment,
	numericSortValue,
} from "../src/modules/metrics";

void test("counts migrated ReadCube annotation headings", () => {
	const note = [
		'<div class="zotero-note znv1">',
		"<h1>ReadCube notes and annotations</h1>",
		"<h2>Highlight</h2><blockquote>one</blockquote>",
		'<h2 class="kind">Note</h2><p>two</p>',
		"<h2>Underline</h2><blockquote>three</blockquote>",
		"</div>",
	].join("");
	assert.equal(countReadCubeHeadings(note), 3);
});

void test("distinguishes written comments from empty HTML", () => {
	assert.equal(hasWrittenComment(undefined), false);
	assert.equal(hasWrittenComment("<p> &nbsp; </p>"), false);
	assert.equal(hasWrittenComment("<p>my interpretation</p>"), true);
});

void test("numeric sort keys sort numerically when Zotero compares strings", () => {
	const values = [100, 2, 10, 0];
	const sorted = values
		.map(numericSortValue)
		.sort()
		.map((value) => Number(displayNumericSortValue(value)));
	assert.deepEqual(sorted, [0, 2, 10, 100]);
});
