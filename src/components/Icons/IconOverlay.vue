<!--
  - SPDX-FileCopyrightText: 2024 Ferdinand Thiessen <opensource@fthiessen.de>
  - SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<!-- The wrapper is what the overlay is placed against; without its class the badge
	     was positioned against whatever ancestor happened to be positioned, and landed
	     on top of the icon it was meant to annotate. -->
	<span class="icon-overlay-wrapper">
		<slot />
		<span class="icon-overlay">
			<slot name="overlay" />
		</span>
	</span>
</template>

<style scoped>
.icon-overlay-wrapper {
	display: inline-flex;
	position: relative;
}

/* A small badge on the top corner, clear of the icon's own shape. */
.icon-overlay {
	color: var(--color-error-text, var(--color-element-error));
	display: inline-flex;
	inset-block-start: -7px;
	inset-inline-end: -7px;
	line-height: 0;
	position: absolute;
	transform: scale(0.6);
}
</style>
