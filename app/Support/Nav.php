<?php

namespace App\Support;

use App\Models\Employee;
use App\Models\User;

/**
 * Port of resources/js/app/nav.ts (navGroups + navFor). Icons are lucide-react component names.
 * Output: [{id, label?, items: [{id, label, to, icon}]}]
 */
final class Nav
{
    /** @return array<int, array<string, mixed>> */
    public static function groups(): array
    {
        $fullTime = fn (Employee $e, string $role) => $e->employment_type === 'full_time';
        $contractor = fn (Employee $e, string $role) => $e->employment_type === 'contractor' && $role !== 'management';

        return [
            ['id' => 'workspace', 'label' => 'Workspace', 'items' => [
                ['id' => 'home', 'label' => 'Home', 'to' => '/', 'icon' => 'House'],
                ['id' => 'my-day', 'label' => 'My day', 'to' => '/my-day', 'icon' => 'Clock'],
                ['id' => 'tasks', 'label' => 'My tasks', 'to' => '/tasks', 'icon' => 'CheckSquare'],
                ['id' => 'projects', 'label' => 'Projects', 'to' => '/projects', 'icon' => 'FolderKanban'],
                ['id' => 'leave', 'label' => 'Leave', 'to' => '/leave', 'icon' => 'CalendarDays'],
                ['id' => 'payslips', 'label' => 'Payslips', 'to' => '/payslips', 'icon' => 'ReceiptText', 'visible' => $fullTime],
                ['id' => 'my-claims', 'label' => 'Claims', 'to' => '/claims', 'icon' => 'Receipt', 'visible' => $contractor],
                ['id' => 'chat', 'label' => 'Chat', 'to' => '/chat', 'icon' => 'MessageSquare'],
                ['id' => 'inbox', 'label' => 'Inbox', 'to' => '/inbox', 'icon' => 'Inbox'],
            ]],
            ['id' => 'team', 'label' => 'Team', 'roles' => ['team_lead', 'hr', 'management'], 'items' => [
                ['id' => 'team', 'label' => 'Team', 'to' => '/team', 'icon' => 'Users'],
                ['id' => 'team-history', 'label' => 'History', 'to' => '/team/history', 'icon' => 'History'],
                ['id' => 'regularizations', 'label' => 'Regularizations', 'to' => '/team/regularizations', 'icon' => 'ClipboardCheck'],
                ['id' => 'leave-approvals', 'label' => 'Leave approvals', 'to' => '/leave/approvals', 'icon' => 'CalendarCheck'],
                ['id' => 'leave-calendar', 'label' => 'Calendar', 'to' => '/leave/calendar', 'icon' => 'Calendar'],
                ['id' => 'claims', 'label' => 'Claims', 'to' => '/claims', 'icon' => 'Receipt', 'roles' => ['team_lead']],
            ]],
            ['id' => 'people-pay', 'label' => 'People & pay', 'roles' => ['hr', 'management'], 'items' => [
                ['id' => 'people', 'label' => 'People', 'to' => '/people', 'icon' => 'UserRound'],
                ['id' => 'payroll', 'label' => 'Payroll', 'to' => '/payroll', 'icon' => 'Wallet'],
            ]],
            ['id' => 'finance', 'label' => 'Finance', 'roles' => ['management'], 'items' => [
                ['id' => 'clients', 'label' => 'Clients', 'to' => '/clients', 'icon' => 'Building2'],
                ['id' => 'invoices', 'label' => 'Invoices', 'to' => '/invoices', 'icon' => 'FileText'],
                ['id' => 'claims', 'label' => 'Claims', 'to' => '/claims', 'icon' => 'Receipt'],
            ]],
            ['id' => 'admin', 'roles' => ['hr', 'management'], 'items' => [
                ['id' => 'settings', 'label' => 'Settings', 'to' => '/settings', 'icon' => 'Settings'],
            ]],
        ];
    }

    /** @return list<array<string, mixed>> */
    public static function for(User $user): array
    {
        $employee = $user->employee;
        $role = $user->role;
        $out = [];
        foreach (self::groups() as $g) {
            if (isset($g['roles']) && ! in_array($role, $g['roles'], true)) {
                continue;
            }
            $items = [];
            foreach ($g['items'] as $i) {
                if (isset($i['roles']) && ! in_array($role, $i['roles'], true)) {
                    continue;
                }
                if (isset($i['visible']) && (! $employee || ! ($i['visible'])($employee, $role))) {
                    continue;
                }
                $items[] = ['id' => $i['id'], 'label' => $i['label'], 'to' => $i['to'], 'icon' => $i['icon']];
            }
            if ($items) {
                $group = ['id' => $g['id']];
                if (isset($g['label'])) {
                    $group['label'] = $g['label'];
                }
                $group['items'] = $items;
                $out[] = $group;
            }
        }

        return $out;
    }
}
