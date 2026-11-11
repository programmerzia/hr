<?php

namespace App\Domain\Billing\Support;

use Illuminate\Notifications\Notification;

class BillingNotification extends Notification
{
    public function __construct(public string $kind, public string $title, public ?string $body, public string $link) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array{kind: string, title: string, body: ?string, link: string} */
    public function toArray(object $notifiable): array
    {
        return ['kind' => $this->kind, 'title' => $this->title, 'body' => $this->body, 'link' => $this->link];
    }
}
