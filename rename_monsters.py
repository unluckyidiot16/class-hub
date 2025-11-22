import os
import re

# ✅ 여기를 자신의 monster 루트 폴더로 바꿔줘
ROOT = "/Users/macair/Downloads/ClassGame/class-hub/docs/games/quizmon/monster"

pattern = re.compile(r"^(\d{1,3})(\.[A-Za-z0-9]+)$")  # 1~3자리 숫자 + 확장자

for dirpath, dirnames, filenames in os.walk(ROOT):
    for name in filenames:
        m = pattern.match(name)
        if not m:
            continue  # 숫자로만 된 파일 이름이 아니면 무시 (예: 3-mega.png)

        num_str, ext = m.groups()

        # 이미 4자리인 건 스킵 (예: 0001.png)
        if len(num_str) == 4:
            continue

        new_name = f"{int(num_str):04d}{ext}"
        src = os.path.join(dirpath, name)
        dst = os.path.join(dirpath, new_name)

        if os.path.exists(dst):
            print(f"⚠️  {dst} already exists, skip")
            continue

        print(f"rename: {src} -> {dst}")
        os.rename(src, dst)
