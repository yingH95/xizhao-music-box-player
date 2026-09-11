from PIL import Image
from pathlib import Path

INPUT = "sprite_sheet1.png"

COLUMNS = 4
ROWS = 4

OUTPUT_DIR = Path("frames_aligned")
OUTPUT_DIR.mkdir(exist_ok=True)

# Vertical adjustment for each row.
# Negative = move artwork upward.
ROW_OFFSETS = [
    -6,  # Frames 1-4
    -1,  # Frames 5-8
     0,  # Frames 9-12
    -2   # Frames 13-16
]

sheet = Image.open(INPUT).convert("RGBA")

frame_width = sheet.width // COLUMNS
frame_height = sheet.height // ROWS

print("Sprite sheet: {}x{}".format(sheet.width, sheet.height))
print("Frame size: {}x{}".format(frame_width, frame_height))


for row in range(ROWS):

    offset_y = ROW_OFFSETS[row]

    for col in range(COLUMNS):

        # Original position in sprite sheet
        left = col * frame_width
        top = row * frame_height

        right = left + frame_width
        bottom = top + frame_height

        frame = sheet.crop(
            (left, top, right, bottom)
        )

        # Create fixed-size transparent canvas
        aligned = Image.new(
            "RGBA",
            (frame_width, frame_height),
            (0, 0, 0, 0)
        )

        # Apply vertical offset
        aligned.alpha_composite(
            frame,
            (0, offset_y)
        )

        # Frame number
        frame_number = row * COLUMNS + col + 1

        output_file = (
            OUTPUT_DIR /
            "frame_{:02d}.png".format(frame_number)
        )

        aligned.save(output_file)

        print(
            "Frame {:02d}: Y offset {}".format(
                frame_number,
                offset_y
            )
        )


print("")
print("Done!")
print("Output directory:", OUTPUT_DIR)