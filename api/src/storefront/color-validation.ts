import { UnprocessableEntityException } from '@nestjs/common';

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function normalizePrimaryColor(value: string | undefined): string | null | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const color = value.trim();
  if (!color) {
    return null;
  }

  if (!HEX_COLOR_PATTERN.test(color)) {
    throw new UnprocessableEntityException('Primary color must be a #RRGGBB hex color');
  }

  const normalized = color.toUpperCase();
  if (getContrastRatioWithWhite(normalized) < 4.5) {
    throw new UnprocessableEntityException('Primary color must meet WCAG AA contrast against white');
  }

  return normalized;
}

function getContrastRatioWithWhite(hexColor: string): number {
  const luminance = relativeLuminance(hexColor);
  return (1.05) / (luminance + 0.05);
}

function relativeLuminance(hexColor: string): number {
  const red = parseInt(hexColor.slice(1, 3), 16);
  const green = parseInt(hexColor.slice(3, 5), 16);
  const blue = parseInt(hexColor.slice(5, 7), 16);

  const [r, g, b] = [red, green, blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
