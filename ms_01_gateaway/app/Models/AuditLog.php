<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['user_id', 'method', 'path', 'status_code', 'correlation_id'])]
class AuditLog extends Model
{
    use HasUuids;

    public const UPDATED_AT = null;
}
