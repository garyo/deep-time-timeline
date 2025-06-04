import type { Component } from 'solid-js'
import { onMount, onCleanup, createEffect } from 'solid-js'
import { eventsState, eventsActions } from '../stores/events-store.ts'

export const CategoryControls: Component = () => {
  let mounted = false

  const setupCategoryHandlers = () => {
    // Master toggle checkbox
    const masterToggle = document.getElementById(
      'category-all-toggle'
    ) as HTMLInputElement
    if (masterToggle) {
      masterToggle.addEventListener('change', handleMasterToggle)
    }

    // Individual category group checkboxes
    Object.keys(eventsState.categoryGroups).forEach((groupName) => {
      const checkbox = document.getElementById(
        `category-${groupName}`
      ) as HTMLInputElement
      if (checkbox) {
        checkbox.addEventListener('change', handleCategoryToggle)
      }
    })
  }

  const cleanupCategoryHandlers = () => {
    const masterToggle = document.getElementById(
      'category-all-toggle'
    ) as HTMLInputElement
    if (masterToggle) {
      masterToggle.removeEventListener('change', handleMasterToggle)
    }

    Object.keys(eventsState.categoryGroups).forEach((groupName) => {
      const checkbox = document.getElementById(
        `category-${groupName}`
      ) as HTMLInputElement
      if (checkbox) {
        checkbox.removeEventListener('change', handleCategoryToggle)
      }
    })
  }

  const handleMasterToggle = (event: Event) => {
    const checkbox = event.target as HTMLInputElement
    const isChecked = checkbox.checked

    if (isChecked) {
      // Select all categories
      eventsActions.selectCategoriesByGroups(eventsState.categoryGroups)
    } else {
      // Deselect all categories
      eventsActions.updateSelectedCategories(new Set())
    }

    // Update all individual checkboxes
    Object.keys(eventsState.categoryGroups).forEach((groupName) => {
      const groupCheckbox = document.getElementById(
        `category-${groupName}`
      ) as HTMLInputElement
      if (groupCheckbox) {
        groupCheckbox.checked = isChecked
      }
    })
  }

  const handleCategoryToggle = (event: Event) => {
    const checkbox = event.target as HTMLInputElement
    const groupName = checkbox.dataset.groupName
    if (!groupName) return

    const isChecked = checkbox.checked
    const newSelectedCategories = new Set(eventsState.selectedCategories)

    if (isChecked) {
      // Add this group's categories
      const categories = eventsState.categoryGroups[groupName] || []
      categories.forEach((cat) => newSelectedCategories.add(cat))
    } else {
      // Remove this group's categories
      const categories = eventsState.categoryGroups[groupName] || []
      categories.forEach((cat) => newSelectedCategories.delete(cat))
    }

    eventsActions.updateSelectedCategories(newSelectedCategories)
    updateMasterToggleState()
  }

  const updateMasterToggleState = () => {
    const masterToggle = document.getElementById(
      'category-all-toggle'
    ) as HTMLInputElement
    if (!masterToggle) return

    const totalGroups = Object.keys(eventsState.categoryGroups).length
    const checkedGroups = Object.keys(eventsState.categoryGroups).filter(
      (groupName) => {
        const checkbox = document.getElementById(
          `category-${groupName}`
        ) as HTMLInputElement
        return checkbox?.checked
      }
    ).length

    if (checkedGroups === 0) {
      masterToggle.checked = false
      masterToggle.indeterminate = false
    } else if (checkedGroups === totalGroups) {
      masterToggle.checked = true
      masterToggle.indeterminate = false
    } else {
      masterToggle.checked = false
      masterToggle.indeterminate = true
    }
  }

  // Effect to sync checkbox states when selectedCategories changes
  createEffect(() => {
    if (!mounted) return

    const selectedCategories = eventsState.selectedCategories

    // Update individual checkboxes based on selected categories
    Object.entries(eventsState.categoryGroups).forEach(
      ([groupName, categories]) => {
        const checkbox = document.getElementById(
          `category-${groupName}`
        ) as HTMLInputElement
        if (checkbox) {
          // Check if all categories in this group are selected
          const allSelected = categories.every((cat) =>
            selectedCategories.has(cat)
          )
          checkbox.checked = allSelected
        }
      }
    )

    // Update master toggle state
    setTimeout(updateMasterToggleState, 0)
  })

  onMount(() => {
    mounted = true
    // Set up event handlers after a brief delay to ensure DOM is ready
    setTimeout(() => {
      setupCategoryHandlers()
      // Initialize checkbox states
      const selectedCategories = eventsState.selectedCategories
      Object.entries(eventsState.categoryGroups).forEach(
        ([groupName, categories]) => {
          const checkbox = document.getElementById(
            `category-${groupName}`
          ) as HTMLInputElement
          if (checkbox) {
            const allSelected = categories.every((cat) =>
              selectedCategories.has(cat)
            )
            checkbox.checked = allSelected
          }
        }
      )
      updateMasterToggleState()
    }, 100)
  })

  onCleanup(() => {
    mounted = false
    cleanupCategoryHandlers()
  })

  // This component is invisible - it just manages event handlers
  return null
}
