<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Foundation\Auth\User as Authenticatable;
use PHPOpenSourceSaver\JWTAuth\Contracts\JWTSubject;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['username', 'password', 'full_name', 'retail_id', 'warehouse_id', 'supplier_id', 'is_active'])]
#[Hidden(['password'])]
class User extends Authenticatable implements JWTSubject
{
    use HasRoles, HasUuids;

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'is_active' => 'boolean',
        ];
    }

    public function primaryRole(): ?string
    {
        return $this->getRoleNames()->first();
    }

    public function getJWTIdentifier(): string
    {
        return (string) $this->getKey();
    }

    /** @return array<string, mixed> */
    public function getJWTCustomClaims(): array
    {
        return [
            'role' => $this->primaryRole(),
            'retail_id' => $this->retail_id,
            'warehouse_id' => $this->warehouse_id,
            'supplier_id' => $this->supplier_id,
        ];
    }
}
