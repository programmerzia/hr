<?php

namespace App\Http\Requests\People;

use Illuminate\Validation\Validator;

/** Salary checks shared by onboarding and "New structure"; messages equal the mock's validateSalary. */
final class SalaryRules
{
    public static function check(Validator $v, mixed $s, bool $hourly, string $prefix = '', bool $needDate = true): void
    {
        $s = is_array($s) ? $s : [];
        $err = fn (string $k, string $m) => $v->errors()->add($prefix.$k, $m);
        if ($needDate && (empty($s['effective_from']) || ! strtotime((string) $s['effective_from']))) {
            $err('effective_from', 'Choose the effective date');
        }
        $num = fn (string $k) => isset($s[$k]) && $s[$k] !== '' && is_numeric($s[$k]) ? (float) $s[$k] : NAN;
        if ($hourly) {
            if (! ($num('hourly_rate') > 0)) {
                $err('hourly_rate', 'Enter an hourly rate above zero');
            }

            return;
        }
        foreach (['basic', 'house_rent', 'medical', 'conveyance', 'tax_monthly'] as $k) {
            if (! ($num($k) >= 0)) {
                $err($k, 'Enter an amount, 0 or more');
            }
        }
        if (! ($num('basic') > 0)) {
            $v->errors()->forget($prefix.'basic');
            $err('basic', 'Basic pay must be above zero');
        }
        $pf = $num('pf_percent');
        if (! ($pf >= 0 && $pf <= 100)) {
            $err('pf_percent', 'Enter a percentage from 0 to 100');
        }
    }

    /** Cast numeric strings and fill zeros for contractors. */
    public static function normalise(array $s, bool $hourly): array
    {
        if ($hourly) {
            return ['effective_from' => $s['effective_from'] ?? null, 'basic' => 0, 'house_rent' => 0, 'medical' => 0, 'conveyance' => 0, 'pf_percent' => 0, 'tax_monthly' => 0, 'hourly_rate' => (int) $s['hourly_rate']];
        }

        return [
            'effective_from' => $s['effective_from'] ?? null,
            'basic' => (int) $s['basic'], 'house_rent' => (int) $s['house_rent'], 'medical' => (int) $s['medical'], 'conveyance' => (int) $s['conveyance'],
            'pf_percent' => (float) $s['pf_percent'], 'tax_monthly' => (int) $s['tax_monthly'],
        ];
    }
}
