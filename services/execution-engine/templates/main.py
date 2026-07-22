# Python 3.12 starter template. Read from stdin, write to stdout.
import sys


def main() -> None:
    data = sys.stdin.read().split()
    if len(data) >= 2:
        print(int(data[0]) + int(data[1]))


if __name__ == "__main__":
    main()
