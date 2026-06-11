/**
 * <HealthPayQuoteFlow /> — the drop-in quote experience.
 *
 *   import { HealthPayQuoteFlow } from "@healthpay/quote-sdk-react-native";
 *
 *   <HealthPayQuoteFlow
 *     baseUrl="https://quotes.healthpay.example"
 *     token={tokenFromYourBackend}
 *     locale="ar"
 *     onConfirmed={(q) => navigation.replace("Done", { code: q.id })}
 *   />
 *
 * Public-token mode: this component talks only to the public token endpoints,
 * so no API secret is ever shipped in the app.
 */

import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useQuoteFlow } from "../hooks";
import { resolveTheme, type HealthPayTheme } from "../theme";
import { isRTL as rtlOf, resolveStrings, type FlowStrings, type Locale } from "../i18n";
import { formatDiscount, formatNumber, formatPrice } from "../format";
import type { Quote, QuoteOption } from "../types";
import { Badge, Card, Header, PrimaryButton } from "./primitives";

export interface HealthPayQuoteFlowProps {
  baseUrl: string;
  /** Quote token from your backend (the one in the SMS link / `quoteUrl`). */
  token: string;
  locale?: Locale;
  theme?: Partial<HealthPayTheme>;
  strings?: Partial<FlowStrings>;
  /** Override fetch (defaults to RN's global). */
  fetch?: typeof fetch;
  intervalMs?: number;
  onConfirmed?: (quote: Quote) => void;
  onError?: (err: Error) => void;
  /** Render your own confirmed screen instead of the built-in one. */
  renderConfirmed?: (quote: Quote) => React.ReactNode;
}

export function HealthPayQuoteFlow(props: HealthPayQuoteFlowProps) {
  const theme = useMemo(() => resolveTheme(props.theme), [props.theme]);
  const locale: Locale = props.locale ?? "en";
  const isRTL = rtlOf(locale);
  const t = useMemo(() => resolveStrings(locale, props.strings), [locale, props.strings]);

  const flow = useQuoteFlow({
    baseUrl: props.baseUrl,
    token: props.token,
    fetch: props.fetch,
    intervalMs: props.intervalMs,
    onConfirmed: props.onConfirmed,
    onError: props.onError,
  });

  const writingDir = isRTL ? "rtl" : "ltr";
  const align = isRTL ? "right" : "left";

  let body: React.ReactNode;
  if (flow.phase === "error") {
    body = (
      <Centered>
        <Text style={{ fontSize: 17, fontWeight: "700", color: theme.text, textAlign: "center" }}>
          {t.errorTitle}
        </Text>
        <Text style={{ color: theme.textMuted, marginTop: 8, textAlign: "center" }}>
          {flow.error?.message}
        </Text>
        <View style={{ height: 16 }} />
        <PrimaryButton label={t.retry} onPress={flow.refresh} theme={theme} isRTL={isRTL} />
      </Centered>
    );
  } else if (flow.phase === "loading" || flow.phase === "pending") {
    body = <Pending theme={theme} strings={t} mobile={flow.quote?.mobile} />;
  } else if (flow.phase === "terminal") {
    body = (
      <Centered>
        <Text style={{ fontSize: 18, fontWeight: "700", color: theme.text, textAlign: "center" }}>
          {flow.quote?.status === "expired" ? t.expiredTitle : t.cancelledTitle}
        </Text>
        {flow.quote?.status === "expired" ? (
          <Text style={{ color: theme.textMuted, marginTop: 8, textAlign: "center" }}>
            {t.expiredBody}
          </Text>
        ) : null}
      </Centered>
    );
  } else if (flow.phase === "confirmed" && flow.quote) {
    body = props.renderConfirmed ? (
      <>{props.renderConfirmed(flow.quote)}</>
    ) : (
      <Confirmed quote={flow.quote} theme={theme} strings={t} locale={locale} align={align} />
    );
  } else {
    // quoted | confirming
    body = (
      <Quoted
        quote={flow.quote!}
        theme={theme}
        strings={t}
        locale={locale}
        isRTL={isRTL}
        align={align}
        selectedOptionId={flow.selectedOptionId}
        onSelect={flow.select}
        onConfirm={flow.confirm}
        confirming={flow.phase === "confirming"}
      />
    );
  }

  const statusLabel = labelForStatus(flow.quote?.status);
  return (
    <View style={{ flex: 1, backgroundColor: theme.background }} {...({ writingDirection: writingDir } as object)}>
      <Header theme={theme} isRTL={isRTL} statusLabel={statusLabel} />
      {body}
    </View>
  );
}

// ---------------------------------------------------------------------------

function Pending({
  theme,
  strings,
  mobile,
}: {
  theme: HealthPayTheme;
  strings: FlowStrings;
  mobile?: string;
}) {
  return (
    <Centered>
      <ActivityIndicator size="large" color={theme.teal} />
      <Text style={{ fontSize: 17, fontWeight: "700", color: theme.text, marginTop: 20, textAlign: "center" }}>
        {strings.preparingTitle}
      </Text>
      <Text style={{ color: theme.textMuted, marginTop: 8, textAlign: "center" }}>
        {strings.preparingBody}
      </Text>
      {mobile ? (
        <View
          style={{
            marginTop: 24,
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderWidth: 1,
            borderRadius: theme.radiusLg,
            padding: 14,
            width: "100%",
          }}
        >
          <Text style={{ color: theme.text, fontWeight: "700", fontSize: 12 }}>{strings.smsSent}</Text>
          <Text style={{ color: theme.textMuted, marginTop: 4 }}>{mobile}</Text>
        </View>
      ) : null}
    </Centered>
  );
}

function Quoted({
  quote,
  theme,
  strings,
  locale,
  isRTL,
  align,
  selectedOptionId,
  onSelect,
  onConfirm,
  confirming,
}: {
  quote: Quote;
  theme: HealthPayTheme;
  strings: FlowStrings;
  locale: Locale;
  isRTL: boolean;
  align: "left" | "right";
  selectedOptionId: string | null;
  onSelect: (id: string) => void;
  onConfirm: () => void;
  confirming: boolean;
}) {
  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        <View style={{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: theme.text }}>{strings.chooseTitle}</Text>
          <Text style={{ color: theme.textMuted, fontSize: 12 }}>{strings.offersCount(quote.options.length)}</Text>
        </View>
        <View style={{ height: 12 }} />
        {quote.options.map((o) => (
          <OptionCard
            key={o.id}
            option={o}
            theme={theme}
            strings={strings}
            locale={locale}
            isRTL={isRTL}
            align={align}
            selected={o.id === selectedOptionId}
            onPress={() => onSelect(o.id)}
          />
        ))}
      </ScrollView>
      <View style={{ padding: 16, paddingTop: 8, backgroundColor: theme.background }}>
        <View style={{ flexDirection: isRTL ? "row-reverse" : "row", alignItems: "center", marginBottom: 10 }}>
          <Text style={{ color: theme.textMuted, fontSize: 11, flex: 1, textAlign: align }}>
            {strings.notInsurance}
          </Text>
        </View>
        <PrimaryButton
          label={confirming ? strings.confirming : strings.confirmSelection}
          onPress={onConfirm}
          theme={theme}
          loading={confirming}
          disabled={!selectedOptionId}
          isRTL={isRTL}
        />
      </View>
    </View>
  );
}

function OptionCard({
  option: o,
  theme,
  strings,
  locale,
  isRTL,
  align,
  selected,
  onPress,
}: {
  option: QuoteOption;
  theme: HealthPayTheme;
  strings: FlowStrings;
  locale: Locale;
  isRTL: boolean;
  align: "left" | "right";
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} style={{ marginBottom: 12 }}>
      <Card theme={theme} selected={selected}>
        <View style={{ flexDirection: isRTL ? "row-reverse" : "row", justifyContent: "space-between" }}>
          <View style={{ flexDirection: isRTL ? "row-reverse" : "row", flex: 1 }}>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                borderWidth: 2,
                borderColor: selected ? theme.teal : theme.border,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 2,
              }}
            >
              {selected ? <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: theme.teal }} /> : null}
            </View>
            <View style={{ marginHorizontal: 10, flex: 1 }}>
              <Text style={{ fontWeight: "700", color: theme.text, fontSize: 14, textAlign: align }}>
                {o.providerName}
              </Text>
              {o.providerAddress ? (
                <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2, textAlign: align }}>
                  {o.providerAddress}
                </Text>
              ) : null}
              {o.serviceDescription ? (
                <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 4, textAlign: align }}>
                  {o.serviceDescription}
                </Text>
              ) : null}
              {o.isAlternative ? (
                <View style={{ marginTop: 8 }}>
                  <Badge label={strings.alternativeBadge} theme={theme} tone="gold" />
                </View>
              ) : null}
            </View>
          </View>
          <View style={{ alignItems: isRTL ? "flex-start" : "flex-end" }}>
            <Badge label={formatDiscount(o.discountPct, locale)} theme={theme} tone="solid" />
            <Text style={{ color: theme.strike, textDecorationLine: "line-through", fontSize: 11, marginTop: 8 }}>
              {formatPrice(o.listPrice, o.currency, locale)}
            </Text>
            <Text style={{ color: theme.text, fontWeight: "700", fontSize: 18 }}>
              {formatPrice(o.discountedPrice, o.currency, locale)}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function Confirmed({
  quote,
  theme,
  strings,
  locale,
  align,
}: {
  quote: Quote;
  theme: HealthPayTheme;
  strings: FlowStrings;
  locale: Locale;
  align: "left" | "right";
}) {
  const chosen = quote.options.find((o) => o.id === quote.selectedOptionId) ?? quote.options[0];
  const saved = chosen ? chosen.listPrice - chosen.discountedPrice : 0;
  const code = `HP-${quote.id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
  return (
    <ScrollView contentContainerStyle={{ padding: 20, alignItems: "center" }}>
      <View
        style={{
          width: 76,
          height: 76,
          borderRadius: 38,
          backgroundColor: theme.tealSoft,
          borderColor: theme.teal,
          borderWidth: 3,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 16,
        }}
      >
        <Text style={{ color: theme.tealDark, fontSize: 38, fontWeight: "700" }}>✓</Text>
      </View>
      <Text style={{ fontSize: 19, fontWeight: "700", color: theme.text, marginTop: 16 }}>
        {strings.confirmedTitle}
      </Text>
      {chosen ? (
        <Text style={{ color: theme.textMuted, marginTop: 6, textAlign: "center" }}>
          {strings.showCode} · {chosen.providerName}
        </Text>
      ) : null}

      <View
        style={{
          backgroundColor: theme.navy,
          borderRadius: theme.radiusLg,
          paddingVertical: 18,
          paddingHorizontal: 24,
          marginTop: 20,
          width: "100%",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#9fb4d6", fontSize: 10, letterSpacing: 2, fontWeight: "700" }}>
          {code ? "DISCOUNT CODE" : ""}
        </Text>
        <Text style={{ color: theme.onPrimary, fontSize: 30, fontWeight: "700", letterSpacing: 3, marginTop: 4 }}>
          {code}
        </Text>
      </View>

      {chosen ? (
        <View
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderWidth: 1.3,
            borderRadius: theme.radiusLg,
            padding: 16,
            marginTop: 16,
            width: "100%",
          }}
        >
          <Row k={strings.youPay} v={formatPrice(chosen.discountedPrice, chosen.currency, locale)} theme={theme} align={align} bold />
          <Row
            k={strings.youSave}
            v={`${formatPrice(saved, chosen.currency, locale)} (${formatNumber(chosen.discountPct, locale)}%)`}
            theme={theme}
            align={align}
          />
          {chosen.providerAddress ? <Row k="" v={chosen.providerAddress} theme={theme} align={align} /> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

function Row({
  k,
  v,
  theme,
  align,
  bold = false,
}: {
  k: string;
  v: string;
  theme: HealthPayTheme;
  align: "left" | "right";
  bold?: boolean;
}) {
  const isRTL = align === "right";
  return (
    <View
      style={{
        flexDirection: isRTL ? "row-reverse" : "row",
        justifyContent: "space-between",
        marginVertical: 4,
      }}
    >
      <Text style={{ color: theme.textMuted, fontSize: 12 }}>{k}</Text>
      <Text style={{ color: theme.text, fontSize: bold ? 16 : 12, fontWeight: bold ? "700" : "400" }}>{v}</Text>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>{children}</View>
  );
}

function labelForStatus(status?: string): string | undefined {
  switch (status) {
    case "pending_quote":
      return "Polling";
    case "quoted":
      return "Quoted";
    case "confirmed":
    case "completed":
      return "Confirmed";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
    default:
      return undefined;
  }
}
