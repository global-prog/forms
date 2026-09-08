<?php

declare(strict_types=1);

/**
 * SPDX-FileCopyrightText: 2026 Nextcloud GmbH and Nextcloud contributors
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\Forms\Migration;

use Closure;
use OCP\DB\ISchemaWrapper;
use OCP\DB\Types;
use OCP\Migration\IOutput;
use OCP\Migration\SimpleMigrationStep;

/**
 * Add a general-purpose settings column to forms.
 *
 * Questions already carry arbitrary configuration in extra_settings_json; forms had no
 * equivalent, so every form-level option needed its own column and therefore its own
 * migration. One nullable JSON column means later options - owner notifications, question
 * shuffling, per-form appearance, prefilled links - cost no schema change at all.
 *
 * Deliberately additive and guarded:
 *   - nullable with no default, so existing rows are untouched and need no backfill
 *   - wrapped in hasColumn(), so re-running is a no-op
 *   - nothing reads it as required; a form with NULL settings behaves exactly as before
 */
class Version050306Date20260909000000 extends SimpleMigrationStep {

	/**
	 * @param IOutput $output
	 * @param Closure $schemaClosure The `\Closure` returns a `ISchemaWrapper`
	 * @param array $options
	 * @return null|ISchemaWrapper
	 */
	public function changeSchema(IOutput $output, Closure $schemaClosure, array $options): ?ISchemaWrapper {
		/** @var ISchemaWrapper $schema */
		$schema = $schemaClosure();
		$table = $schema->getTable('forms_v2_forms');

		if (!$table->hasColumn('settings_json')) {
			$table->addColumn('settings_json', Types::TEXT, [
				'notnull' => false,
				'default' => null,
				'comment' => 'JSON blob of optional form-level settings',
			]);
		}

		return $schema;
	}
}
