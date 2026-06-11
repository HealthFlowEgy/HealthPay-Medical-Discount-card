/// Data models mirroring the token-authenticated quote-page REST contract.

enum RequestStatus {
  pendingQuote,
  quoted,
  confirmed,
  completed,
  expired,
  cancelled,
  unknown,
}

RequestStatus requestStatusFromString(String? value) {
  switch (value) {
    case 'pending_quote':
      return RequestStatus.pendingQuote;
    case 'quoted':
      return RequestStatus.quoted;
    case 'confirmed':
      return RequestStatus.confirmed;
    case 'completed':
      return RequestStatus.completed;
    case 'expired':
      return RequestStatus.expired;
    case 'cancelled':
      return RequestStatus.cancelled;
    default:
      return RequestStatus.unknown;
  }
}

/// One pricing option as seen by the token bearer (the member).
class QuoteOption {
  const QuoteOption({
    required this.id,
    required this.providerId,
    required this.isAlternative,
    required this.providerName,
    required this.providerAddress,
    required this.serviceDescription,
    required this.listPrice,
    required this.discountedPrice,
    required this.discountPct,
    required this.currency,
    required this.validityNote,
    required this.extraInfo,
  });

  final String id;

  /// Linked directory provider, if any.
  final String? providerId;

  /// True when proposed at a different provider than the member originally chose.
  final bool isAlternative;
  final String providerName;
  final String? providerAddress;
  final String serviceDescription;
  final num listPrice;
  final num discountedPrice;
  final num discountPct;
  final String currency;
  final String? validityNote;
  final Map<String, dynamic>? extraInfo;

  factory QuoteOption.fromJson(Map<String, dynamic> json) {
    return QuoteOption(
      id: json['id'] as String,
      providerId: json['providerId'] as String?,
      isAlternative: json['isAlternative'] as bool? ?? false,
      providerName: json['providerName'] as String? ?? '',
      providerAddress: json['providerAddress'] as String?,
      serviceDescription: json['serviceDescription'] as String? ?? '',
      listPrice: json['listPrice'] as num? ?? 0,
      discountedPrice: json['discountedPrice'] as num? ?? 0,
      discountPct: json['discountPct'] as num? ?? 0,
      currency: json['currency'] as String? ?? 'EGP',
      validityNote: json['validityNote'] as String?,
      extraInfo: (json['extraInfo'] as Map?)?.cast<String, dynamic>(),
    );
  }
}

/// The member-facing quote, returned by `GET /api/v1/quote/:token`.
class Quote {
  const Quote({
    required this.id,
    required this.status,
    required this.serviceType,
    required this.providerType,
    required this.specialty,
    required this.governorate,
    required this.area,
    required this.city,
    required this.mobile,
    required this.memberNameEn,
    required this.memberNameAr,
    required this.expiresAt,
    required this.options,
    required this.selectedOptionId,
  });

  final String id;
  final RequestStatus status;
  final String serviceType;
  final String? providerType;
  final String? specialty;
  final String governorate;
  final String? area;
  final String? city;

  /// Masked, e.g. "+20 100 •••• 567".
  final String mobile;
  final String? memberNameEn;
  final String? memberNameAr;
  final String expiresAt;
  final List<QuoteOption> options;
  final String? selectedOptionId;

  QuoteOption? get selectedOption {
    for (final o in options) {
      if (o.id == selectedOptionId) return o;
    }
    return options.isNotEmpty ? options.first : null;
  }

  factory Quote.fromJson(Map<String, dynamic> json) {
    final rawOptions = (json['options'] as List?) ?? const [];
    return Quote(
      id: json['id'] as String,
      status: requestStatusFromString(json['status'] as String?),
      serviceType: json['serviceType'] as String? ?? '',
      providerType: json['providerType'] as String?,
      specialty: json['specialty'] as String?,
      governorate: json['governorate'] as String? ?? '',
      area: json['area'] as String?,
      city: json['city'] as String?,
      mobile: json['mobile'] as String? ?? '',
      memberNameEn: json['memberNameEn'] as String?,
      memberNameAr: json['memberNameAr'] as String?,
      expiresAt: json['expiresAt'] as String? ?? '',
      selectedOptionId: json['selectedOptionId'] as String?,
      options: rawOptions
          .map((e) => QuoteOption.fromJson((e as Map).cast<String, dynamic>()))
          .toList(growable: false),
    );
  }
}
