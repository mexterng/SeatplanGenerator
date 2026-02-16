#!/bin/bash
# stop on error
echo "Starting ..."
set -e

cd "$(dirname "$0")"
cd ".."

# Input- und Output-Ordner
INPUT_DIR="./css/input"
OUTPUT_DIR="./css"

# configuration
INPUT="./css/input/styles.css"
OUTPUT_DIR="./css"
BASENAME="styles"

for INPUT_FILE in "$INPUT_DIR"/*.css; do
    BASENAME=$(basename "$INPUT_FILE" .css)
    # build paths
    OUTPUT_DEV="${OUTPUT_DIR}/${BASENAME}.css"
    OUTPUT_MIN="${OUTPUT_DIR}/${BASENAME}.min.css"

    #echo "Build '$INPUT_FILE' to '$OUTPUT_MIN' ..."
    # build minified version
    #npx @tailwindcss/cli -i "$INPUT_FILE" -o "$OUTPUT_MIN" --minify

    echo "Build '$INPUT_FILE' to '$OUTPUT_DEV' ..."
    # build normal version
    npx @tailwindcss/cli -i "$INPUT_FILE" -o "$OUTPUT_DEV"
done

echo "All CSS builds completed."