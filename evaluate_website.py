"""Run the Dallas itinerary content and asset contract tests."""

import sys
import unittest


def main() -> int:
    suite = unittest.defaultTestLoader.loadTestsFromName("tests.test_itinerary")
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if result.wasSuccessful():
        print(f"\nDallas itinerary audit passed: {result.testsRun} checks")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
