"""Tests for state.py — FileState backend (no Redis required)."""

import os
import tempfile
import threading

from newsbot.state import FileState, reset_state


class TestFileState:
    def setup_method(self):
        self._tmp = tempfile.mkdtemp()
        self._sub_path = os.path.join(self._tmp, "subscribers.json")
        self._posted_path = os.path.join(self._tmp, "posted_ids.json")
        self.state = FileState(self._sub_path, self._posted_path)

    def teardown_method(self):
        for f in [self._sub_path, self._posted_path]:
            if os.path.exists(f):
                os.remove(f)
        titles_path = self._posted_path.replace(".json", "_titles.json")
        if os.path.exists(titles_path):
            os.remove(titles_path)
        briefed_path = self._posted_path.replace("posted_ids", "briefed_ids")
        if os.path.exists(briefed_path):
            os.remove(briefed_path)
        group_threads_path = self._sub_path.replace("subscribers", "group_threads")
        if os.path.exists(group_threads_path):
            os.remove(group_threads_path)
        os.rmdir(self._tmp)
        reset_state()

    def test_load_subscribers_empty(self):
        assert self.state.load_subscribers() == set()

    def test_save_and_load_subscribers(self):
        ids = {123, 456, 789}
        self.state.save_subscribers(ids)
        assert self.state.load_subscribers() == ids

    def test_save_subscribers_replaces_previous(self):
        self.state.save_subscribers({111})
        self.state.save_subscribers({222, 333})
        assert self.state.load_subscribers() == {222, 333}

    def test_load_group_threads_empty(self):
        assert self.state.load_group_threads() == {}

    def test_save_and_load_group_threads(self):
        self.state.save_group_threads({-100: 42, -101: 7})
        assert self.state.load_group_threads() == {-100: 42, -101: 7}

    def test_save_group_threads_replaces_previous(self):
        self.state.save_group_threads({-100: 1})
        self.state.save_group_threads({-100: 42})
        assert self.state.load_group_threads() == {-100: 42}

    def test_corrupt_group_threads_file_returns_empty(self):
        path = self._sub_path.replace("subscribers", "group_threads")
        with open(path, "w") as f:
            f.write("not valid json {{{")
        assert self.state.load_group_threads() == {}

    def test_missing_group_threads_file_returns_empty(self):
        assert self.state.load_group_threads() == {}

    def test_corrupt_subscribers_file_returns_empty(self):
        with open(self._sub_path, "w") as f:
            f.write("not valid json {{{")
        assert self.state.load_subscribers() == set()

    def test_missing_subscribers_file_returns_empty(self):
        assert self.state.load_subscribers() == set()

    def test_load_posted_ids_empty(self):
        assert self.state.load_posted_ids() == set()

    def test_save_and_load_posted_ids(self):
        ids = {"entry-1", "entry-2", "entry-3"}
        self.state.save_posted_ids(ids)
        assert self.state.load_posted_ids() == ids

    def test_save_posted_ids_replaces_previous(self):
        self.state.save_posted_ids({"old-id"})
        self.state.save_posted_ids({"new-id"})
        assert self.state.load_posted_ids() == {"new-id"}

    def test_corrupt_posted_ids_file_returns_empty(self):
        with open(self._posted_path, "w") as f:
            f.write("{broken}")
        assert self.state.load_posted_ids() == set()

    def test_missing_posted_ids_file_returns_empty(self):
        assert self.state.load_posted_ids() == set()

    def test_add_posted_ids_merges(self):
        self.state.save_posted_ids({"a"})
        self.state.add_posted_ids({"b", "c"})
        assert self.state.load_posted_ids() == {"a", "b", "c"}

    def test_add_posted_ids_no_duplicates(self):
        self.state.save_posted_ids({"a", "b"})
        self.state.add_posted_ids({"b", "c"})
        assert self.state.load_posted_ids() == {"a", "b", "c"}

    def test_add_posted_ids_to_empty(self):
        self.state.add_posted_ids({"x"})
        assert self.state.load_posted_ids() == {"x"}

    def test_atomic_write_no_temp_files_left(self):
        self.state.save_subscribers({999})
        dir_contents = os.listdir(self._tmp)
        tmp_files = [f for f in dir_contents if f.endswith(".tmp")]
        assert tmp_files == [], f"Temp files left behind: {tmp_files}"

    def test_atomic_write_survives_corruption_check(self):
        self.state.save_posted_ids({"a", "b"})
        assert self.state.load_posted_ids() == {"a", "b"}
        self.state.add_posted_ids({"c"})
        assert self.state.load_posted_ids() == {"a", "b", "c"}

    def test_add_posted_titles_merges(self):
        self.state.save_posted_titles({"title1"})
        self.state.add_posted_titles({"title2"})
        assert self.state.load_posted_titles() == {"title1", "title2"}

    def test_add_posted_titles_no_duplicates(self):
        self.state.save_posted_titles({"a", "b"})
        self.state.add_posted_titles({"b", "c"})
        assert self.state.load_posted_titles() == {"a", "b", "c"}

    def test_briefed_ids_roundtrip(self):
        assert self.state.load_briefed_ids() == set()
        self.state.add_briefed_ids({"b1", "b2"})
        assert self.state.load_briefed_ids() == {"b1", "b2"}
        self.state.add_briefed_ids({"b2", "b3"})
        assert self.state.load_briefed_ids() == {"b1", "b2", "b3"}
        self.state.save_briefed_ids({"only"})
        assert self.state.load_briefed_ids() == {"only"}


class TestFileStateThreadSafety:
    def setup_method(self):
        self._tmp = tempfile.mkdtemp()
        self._sub_path = os.path.join(self._tmp, "subscribers.json")
        self._posted_path = os.path.join(self._tmp, "posted_ids.json")
        self.state = FileState(self._sub_path, self._posted_path)

    def teardown_method(self):
        for f in [self._sub_path, self._posted_path]:
            if os.path.exists(f):
                os.remove(f)
        titles_path = self._posted_path.replace(".json", "_titles.json")
        if os.path.exists(titles_path):
            os.remove(titles_path)
        briefed_path = self._posted_path.replace("posted_ids", "briefed_ids")
        if os.path.exists(briefed_path):
            os.remove(briefed_path)
        os.rmdir(self._tmp)
        reset_state()

    def test_concurrent_add_posted_ids(self):
        errors = []

        def add_ids(chunk):
            try:
                self.state.add_posted_ids(chunk)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=add_ids, args=({f"id-{i}"},)) for i in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert errors == [], f"Concurrent writes raised: {errors}"
        result = self.state.load_posted_ids()
        assert len(result) == 20
