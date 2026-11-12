<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

class PasswordResetNotification extends Notification
{
    public function __construct(public string $requestId, public string $title, public ?string $body) {}

    /** @return list<string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string,mixed> */
    public function toArray(object $notifiable): array
    {
        return ['kind' => 'password_reset', 'title' => $this->title, 'body' => $this->body, 'link' => '/inbox', 'request_id' => $this->requestId];
    }
}
