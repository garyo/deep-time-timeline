import math

def generate_log_ruler_svg(
    num_marks=8,
    width=100,
    height=100,
    margin=10,
    baseline_y=70,
    color="#333",
    baseline_thickness=3,
    mark_thickness=2,
    tall_height=40,
    medium_height=30,
    short_height=20
):
    """
    Generate an SVG with log-spaced ruler markings.

    Args:
        num_marks: Number of ruler markings (including endpoints)
        width, height: SVG dimensions
        margin: Left/right margin
        baseline_y: Y position of the horizontal baseline
        color: Stroke color
        baseline_thickness: Thickness of horizontal line
        mark_thickness: Thickness of vertical markings
        tall_height, medium_height, short_height: Heights for different marks
    """

    svg_lines = []
    svg_lines.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}">')

    # Horizontal baseline
    x_start = margin
    x_end = width - margin
    svg_lines.append(f'  <!-- Horizontal baseline -->')
    svg_lines.append(f'  <line x1="{x_start}" y1="{baseline_y}" x2="{x_end}" y2="{baseline_y}" stroke="{color}" stroke-width="{baseline_thickness}"/>')
    svg_lines.append('')
    svg_lines.append(f'  <!-- Log-spaced markings -->')

    # Calculate log-spaced positions
    ruler_width = x_end - x_start

    for i in range(num_marks):
        # Log spacing: position proportional to log(i+1)
        if num_marks == 1:
            ratio = 0
        else:
            ratio = math.log(i + 1) / math.log(num_marks)

        x_pos = x_start + ruler_width * ratio

        # Vary the height: tall at endpoints, alternate medium/short in between
        if i == 0 or i == num_marks - 1:
            mark_height = tall_height
            thickness = mark_thickness + 0.5
        elif i % 2 == 0:
            mark_height = medium_height
            thickness = mark_thickness
        else:
            mark_height = short_height
            thickness = mark_thickness

        y_top = baseline_y - mark_height

        svg_lines.append(f'  <!-- Mark {i}: x≈{x_pos:.1f} -->')
        svg_lines.append(f'  <line x1="{x_pos:.1f}" y1="{baseline_y}" x2="{x_pos:.1f}" y2="{y_top}" stroke="{color}" stroke-width="{thickness}"/>')
        svg_lines.append('')

    svg_lines.append('</svg>')

    return '\n'.join(svg_lines)


# Generate the SVG
svg_content = generate_log_ruler_svg(
    num_marks=10,
    width=64,
    height=64,
    margin=5,
    baseline_y=55,
    color="#333",
    baseline_thickness=3,
    mark_thickness=2,
    tall_height=40,
    medium_height=30,
    short_height=20
)

# Save to file
output_file = "log_ruler_favicon.svg"
with open(output_file, 'w') as f:
    f.write(svg_content)

print(f"SVG saved to {output_file}")
# print("\nGenerated SVG:")
# print(svg_content)

# Try different variations!
# Uncomment to experiment:

# More marks
# svg_content = generate_log_ruler_svg(num_marks=12)

# Different colors
# svg_content = generate_log_ruler_svg(color="#0066cc")

# Larger canvas
# svg_content = generate_log_ruler_svg(width=200, height=200, margin=20)
