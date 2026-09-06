<?php

use App\Enums\Channel;
use App\Enums\IntegrationType;

it('has exactly the five integration types in declaration order', function () {
    expect(IntegrationType::values())->toBe(['erp', 'email', 'sms', 'whatsapp', 'api_webhook']);
});

it('is a distinct set from App\Enums\Channel — Decision 1 in the story plan', function () {
    $channelValues = array_map(fn (Channel $c) => $c->value, Channel::cases());
    $integrationValues = IntegrationType::values();

    // Overlapping, not identical: erp and api_webhook exist only on one side,
    // chat and web_form only on the other.
    expect($integrationValues)->not->toBe($channelValues);
    expect($integrationValues)->toContain('erp');
    expect($integrationValues)->toContain('api_webhook');
    expect($channelValues)->not->toContain('erp');
    expect($channelValues)->not->toContain('api_webhook');
    expect($integrationValues)->not->toContain('chat');
    expect($integrationValues)->not->toContain('web_form');
});

it('resolves a label_key per type, following the type.<value>.label convention', function () {
    expect(IntegrationType::Erp->labelKey())->toBe('integrations.type.erp.label');
    expect(IntegrationType::ApiWebhook->labelKey())->toBe('integrations.type.api_webhook.label');
});
