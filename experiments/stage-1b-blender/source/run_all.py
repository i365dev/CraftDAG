"""Run each fixed benchmark case in one real Blender process."""
import os
import runpy
import sys

SOURCE = os.path.join(os.path.dirname(__file__), "author_scene.py")
CASES = ("simple-house", "castle-tower", "ship", "statue", "dragon")

for case in CASES:
    sys.argv = [SOURCE, "--", case]
    runpy.run_path(SOURCE, run_name="__main__")
