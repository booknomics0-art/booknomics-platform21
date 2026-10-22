import csv
import json
import tempfile
import unittest
from pathlib import Path
from importlib.machinery import SourceFileLoader
from importlib.util import module_from_spec, spec_from_loader


SCRIPT = Path(__file__).resolve().parents[1] / "translation" / "aggregate_batch_reports.py"
LOADER = SourceFileLoader("batch_aggregate", str(SCRIPT))
SPEC = spec_from_loader(LOADER.name, LOADER)
module = module_from_spec(SPEC)
LOADER.exec_module(module)


class AggregateTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.manifest = self.root / "manifest.csv"
        with self.manifest.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=["book_id", "translation_status"])
            writer.writeheader()
            writer.writerows([
                {"book_id": "first", "translation_status": "pending_translation"},
                {"book_id": "second", "translation_status": "pending_translation"},
                {"book_id": "manual", "translation_status": "partial_7_of_9"},
            ])
        (self.root / "shard1").mkdir()
        (self.root / "shard1" / "report.json").write_text(json.dumps({"items": [
            {"book_id": "first", "status": "offline_machine_draft_needs_editorial_review"},
        ]}), encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def test_missing_pending_id_is_reported(self):
        result = module.aggregate(self.manifest, self.root)
        self.assertEqual(result["previouslyAuthoredOrPartial"], 1)
        self.assertEqual(result["missingBookIds"], ["second"])
        self.assertFalse(result["coverageComplete"])
        self.assertEqual(result["published"], 0)

    def test_all_pending_books_accounted_for(self):
        (self.root / "shard2").mkdir()
        (self.root / "shard2" / "report.json").write_text(json.dumps({"items": [
            {"book_id": "second", "status": "source_needs_rework"},
        ]}), encoding="utf-8")
        result = module.aggregate(self.manifest, self.root)
        self.assertTrue(result["coverageComplete"])
        self.assertEqual(result["accountedFor"], 2)
        self.assertEqual(result["machineDraftsCreated"], 1)
        self.assertEqual(result["statuses"]["source_needs_rework"], 1)


if __name__ == "__main__":
    unittest.main()
