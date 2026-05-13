import { IsIn } from 'class-validator';

export enum ThemePreferenceDto {
  LIGHT = 'LIGHT',
  DARK = 'DARK',
}

export class SetThemePreferenceDto {
  @IsIn([ThemePreferenceDto.LIGHT, ThemePreferenceDto.DARK])
  themePreference!: ThemePreferenceDto;
}
