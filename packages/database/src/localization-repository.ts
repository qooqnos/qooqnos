import { DatabaseError, D1Database, Repository } from "./client";

export type LocalizationDirection = "ltr" | "rtl";
export type LocalizationCalendar = "gregorian" | "jalali";
export type RegistryStatus = "draft" | "active" | "retired";

export interface LocaleRegistryRecord {
  readonly code: string;
  readonly languageCode: string;
  readonly scriptCode: string;
  readonly direction: LocalizationDirection;
  readonly defaultCalendar: LocalizationCalendar;
  readonly fallbackLocaleCode: string | null;
  readonly status: "active" | "retired";
  readonly metadataJson: string | null;
}

export interface CountryRegistryRecord {
  readonly code: string;
  readonly name: string;
  readonly defaultLocaleCode: string;
  readonly defaultCurrencyCode: string;
  readonly defaultTimezone: string;
  readonly legalProfileId: string | null;
  readonly status: "active" | "retired";
  readonly metadataJson: string | null;
}

export interface RegionRegistryRecord {
  readonly id: string;
  readonly countryCode: string;
  readonly code: string;
  readonly name: string;
  readonly regionType: string;
  readonly parentRegionId: string | null;
  readonly status: "active" | "retired";
  readonly metadataJson: string | null;
}

export interface LegalProfileRegistryRecord {
  readonly id: string;
  readonly jurisdictionCode: string;
  readonly version: string;
  readonly status: RegistryStatus;
  readonly effectiveAt: string;
  readonly policyJson: string;
}

export interface MarketProfileRegistryRecord {
  readonly id: string;
  readonly marketCode: string;
  readonly countryCode: string;
  readonly regionId: string | null;
  readonly localeCode: string;
  readonly legalProfileId: string | null;
  readonly timezone: string;
  readonly currencyCode: string;
  readonly calendarCode: LocalizationCalendar;
  readonly status: "active" | "retired";
  readonly configJson: string;
  readonly version: string;
  readonly effectiveAt: string;
}

export interface DomainLocalizationConfigRecord {
  readonly id: string;
  readonly marketCode: string;
  readonly domainKey: string;
  readonly localeCode: string | null;
  readonly version: string;
  readonly status: RegistryStatus;
  readonly configJson: string;
  readonly effectiveAt: string;
}

export interface ResolvedLocalizationContext {
  readonly market: MarketProfileRegistryRecord;
  readonly country: CountryRegistryRecord;
  readonly locale: LocaleRegistryRecord;
  readonly region: RegionRegistryRecord | null;
  readonly legalProfile: LegalProfileRegistryRecord | null;
  readonly domainConfig: DomainLocalizationConfigRecord | null;
}

/**
 * Canonical physical registry for localization and jurisdiction context.
 *
 * This repository deliberately owns registry facts only. It must not be
 * duplicated by domain-specific country/locale tables.
 */
export class LocalizationRegistryRepository extends Repository {
  constructor(database: D1Database) {
    super(database);
  }

  async getLocale(code: string): Promise<LocaleRegistryRecord | null> {
    return this.database.first<LocaleRegistryRecord>(
      `SELECT code, language_code AS languageCode, script_code AS scriptCode,
              direction, default_calendar AS defaultCalendar,
              fallback_locale_code AS fallbackLocaleCode, status, metadata_json AS metadataJson
       FROM localization_locales WHERE code = ? LIMIT 1`,
      this.normalizeCode(code),
    );
  }

  async getCountry(code: string): Promise<CountryRegistryRecord | null> {
    return this.database.first<CountryRegistryRecord>(
      `SELECT code, name, default_locale_code AS defaultLocaleCode,
              default_currency_code AS defaultCurrencyCode,
              default_timezone AS defaultTimezone,
              legal_profile_id AS legalProfileId, status, metadata_json AS metadataJson
       FROM localization_countries WHERE code = ? LIMIT 1`,
      this.normalizeCode(code),
    );
  }

  async getMarketProfile(marketCode: string): Promise<MarketProfileRegistryRecord | null> {
    return this.database.first<MarketProfileRegistryRecord>(
      `SELECT id, market_code AS marketCode, country_code AS countryCode,
              region_id AS regionId, locale_code AS localeCode,
              legal_profile_id AS legalProfileId, timezone, currency_code AS currencyCode,
              calendar_code AS calendarCode, status, config_json AS configJson,
              version, effective_at AS effectiveAt
       FROM localization_market_profiles
       WHERE market_code = ? AND status = 'active'
       LIMIT 1`,
      marketCode.trim(),
    );
  }

  async resolve(
    marketCode: string,
    domainKey?: string,
  ): Promise<ResolvedLocalizationContext | null> {
    const market = await this.getMarketProfile(marketCode);
    if (!market) return null;

    const country = await this.getCountry(market.countryCode);
    const locale = await this.getLocale(market.localeCode);
    if (!country || !locale) {
      throw new DatabaseError("Localization market profile references missing registry data");
    }

    const region = market.regionId
      ? await this.database.first<RegionRegistryRecord>(
        `SELECT id, country_code AS countryCode, code, name, region_type AS regionType,
                parent_region_id AS parentRegionId, status, metadata_json AS metadataJson
         FROM localization_regions WHERE id = ? LIMIT 1`,
        market.regionId,
      )
      : null;

    const legalProfile = market.legalProfileId
      ? await this.database.first<LegalProfileRegistryRecord>(
        `SELECT id, jurisdiction_code AS jurisdictionCode, version, status,
                effective_at AS effectiveAt, policy_json AS policyJson
         FROM localization_legal_profiles WHERE id = ? LIMIT 1`,
        market.legalProfileId,
      )
      : null;

    const domainConfig = domainKey
      ? await this.database.first<DomainLocalizationConfigRecord>(
        `SELECT id, market_code AS marketCode, domain_key AS domainKey,
                locale_code AS localeCode, version, status,
                config_json AS configJson, effective_at AS effectiveAt
         FROM localization_domain_configs
         WHERE market_code = ? AND domain_key = ? AND status = 'active'
         ORDER BY effective_at DESC, version DESC
         LIMIT 1`,
        market.marketCode,
        domainKey,
      )
      : null;

    return { market, country, locale, region, legalProfile, domainConfig };
  }

  async listActiveLocales(): Promise<readonly LocaleRegistryRecord[]> {
    return this.database.all<LocaleRegistryRecord>(
      `SELECT code, language_code AS languageCode, script_code AS scriptCode,
              direction, default_calendar AS defaultCalendar,
              fallback_locale_code AS fallbackLocaleCode, status, metadata_json AS metadataJson
       FROM localization_locales WHERE status = 'active' ORDER BY code ASC`,
    );
  }

  private normalizeCode(value: string): string {
    const normalized = value.trim();
    if (!normalized) throw new DatabaseError("Localization registry code is required");
    return normalized;
  }
}
