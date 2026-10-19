export type Language = 'fa' | 'en';

export interface DesignToken {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
  surfaceColor: string;
  textColor: string;
  borderRadius: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  fontFamily: string;
}

export interface ShowcaseTemplate {
  id: string;
  titleFa: string;
  titleEn: string;
  categoryFa: string;
  categoryEn: string;
  descriptionFa: string;
  descriptionEn: string;
  tags: string[];
}
