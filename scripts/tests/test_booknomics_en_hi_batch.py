import argparse
import csv
import json
import tempfile
import unittest
from pathlib import Path
from importlib.machinery import SourceFileLoader
from importlib.util import spec_from_loader, module_from_spec


ROOT = Path(__file__).resolve().parents[1]
LOADER = SourceFileLoader("en_hi_batch", str(ROOT / "booknomics_en_hi_batch.py"))
SPEC = spec_from_loader(LOADER.name, LOADER)
module = module_from_spec(SPEC)
LOADER.exec_module(module)


class DummyLocalTranslator:
    def __init__(self):
        self.calls = 0

    def translate_batch(self, segments):
        self.calls += len(segments)
        return ["संबंधित हिंदी पुस्तक सामग्री " * max(1, round(len(s) / 29)) for s in segments]


class OfflineBatchTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.book_id = "11111111-2222-3333-4444-555555555555"
        self.book = {
            "id": self.book_id, "title": "Meaningful Book", "slug": "meaningful-book",
            "author": "Reader", "language": "en", "is_draft": False, "status": "published",
            "overview": "**The central idea** gives readers a clear framework for practical learning.",
            "deep_summary": "### Clear learning\n\nRead one argument carefully, then examine the evidence and its limitations.",
            "key_ideas": "- **Evidence:** Distinguish strong evidence from unfounded confidence.\n- **Practice:** Test one idea.",
            "deep_analysis": "### Context\n\nUnderstand the context and the author's reasoning.",
            "daily_application": "Review one example and write how it connects to the book.",
        }
        for field in module.FIELDS:
            self.book.setdefault(field, "")
        self.manifest = self.root / "manifest.csv"
        fields = ["batch_index", "book_id", "slug", "title", "author", "source_language", "target_language",
                  "source_database", "source_status", "translation_status"] + [f + "_chars" for f in module.FIELDS]
        with self.manifest.open("w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fields)
            writer.writeheader()
            writer.writerow(dict(batch_index=1, book_id=self.book_id, slug=self.book["slug"],
                                 title=self.book["title"], author=self.book["author"], source_language="en",
                                 target_language="hi", source_database="Supabase", source_status="published",
                                 translation_status="pending_translation",
                                 **{k + "_chars": len(self.book[k]) for k in module.FIELDS}))
        self.source = self.root / "books.jsonl"
        self.source.write_text(json.dumps(self.book) + "\n", encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def test_manifest_and_source_validation(self):
        rows = module.read_manifest(self.manifest)
        self.assertEqual(len(rows), 1)
        self.assertEqual(module.check_source(self.book, rows[0]), [])
        self.assertEqual(module.source_hash({"overview": "some English"}),
                         module.source_hash({"overview": "some English"}))

    def test_generic_empty_headings_are_rejected(self):
        wrong = dict(self.book, deep_summary="### Motivation\n\n### Meaning\n\n### Plot\n\n### Ending")
        row = module.read_manifest(self.manifest)[0].copy()
        row["deep_summary_chars"] = str(len(wrong["deep_summary"]))
        self.assertIn("deep_summary may contain template-only headings", module.check_source(wrong, row))

    def test_markdown_structure_and_inline_spaces(self):
        engine = DummyLocalTranslator()
        result = module.translate_markdown("### Chapter\n\n- **Evidence:** Helps explain choices.\n", engine)
        self.assertEqual(len(module.HEADING.findall(result)), 1)
        self.assertTrue(result.startswith("### "))
        self.assertIn("**", result)
        self.assertIn("** ", module.translate_inline("**Term** More words", engine, 340))

    def test_resumable_draft_never_approved(self):
        engine = DummyLocalTranslator()
        output = self.root / "out" / "draft.json"
        result = module.process_book(self.book, output, engine)
        doc = json.loads(output.read_text(encoding="utf-8"))
        self.assertFalse(doc["approved"])
        self.assertEqual(set(doc["sourceSections"]), set(doc["translatedSections"]))
        self.assertIn("offline_machine_draft", result["status"])
        prior_calls = engine.calls
        module.process_book(self.book, output, engine)
        self.assertEqual(engine.calls, prior_calls, "Resume should not regenerate finished fields")

    def test_dry_run_has_no_translation(self):
        args = argparse.Namespace(manifest=self.manifest, source_jsonl=self.source,
                                  out_dir=self.root / "results", manual_drafts_dir=self.root / "manual",
                                  offset=0, limit=1, dry_run=True, model_dir=self.root / "missing",
                                  device="cpu", model_batch_size=8, max_chars=340, pending_only=True)
        result = module.run(args)
        self.assertEqual(result["counts"], {"source_validated_dry_run": 1})
        self.assertTrue((args.out_dir / "report.json").exists())


if __name__ == "__main__":
    unittest.main()
