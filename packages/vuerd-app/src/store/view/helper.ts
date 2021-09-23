import { Tab, useViewStore, ViewNode } from '@/store/view';
import {
  Placement,
  SIZE_SPLIT_MIN,
  SIZE_SPLIT_MIN_HEIGHT,
} from '@/store/view/constants';

export function resetSize(container: ViewNode) {
  const width = container.vertical
    ? container.width / container.children.length
    : container.width;
  const widthRatio = container.vertical ? 1 / container.children.length : 1;
  const height = container.horizontal
    ? container.height / container.children.length
    : container.height;
  const heightRatio = container.horizontal ? 1 / container.children.length : 1;
  container.children.forEach((view: ViewNode) => {
    view.width = width;
    view.widthRatio = widthRatio;
    view.height = height;
    view.heightRatio = heightRatio;
    resetSize(view);
  });
}

export function resetWidth(container: ViewNode) {
  const width = container.vertical
    ? container.width / container.children.length
    : container.width;
  const widthRatio = container.vertical ? 1 / container.children.length : 1;
  container.children.forEach((view: ViewNode) => {
    view.width = width;
    view.widthRatio = widthRatio;
    resetWidth(view);
  });
}

export function resetHeight(container: ViewNode) {
  const height = container.horizontal
    ? container.height / container.children.length
    : container.height;
  const heightRatio = container.horizontal ? 1 / container.children.length : 1;
  container.children.forEach((view: ViewNode) => {
    view.height = height;
    view.heightRatio = heightRatio;
    resetHeight(view);
  });
}

export function resetWidthRatio(container: ViewNode) {
  container.children.forEach((view: ViewNode) => {
    view.width = container.width * view.widthRatio;
    resetWidthRatio(view);
  });
}

export function resetHeightRatio(container: ViewNode) {
  container.children.forEach((view: ViewNode) => {
    view.height = container.height * view.heightRatio;
    resetHeightRatio(view);
  });
}

export function minVertical(container: ViewNode): number {
  let widthSum = 0;
  let widthMax = SIZE_SPLIT_MIN;
  container.children.forEach((view: ViewNode) => {
    const width = minVertical(view);
    if (container.vertical) {
      widthSum += width;
    } else if (widthMax < width) {
      widthMax = width;
    }
  });
  let result = 0;
  if (container.vertical && container.children.length === 0) {
    result = SIZE_SPLIT_MIN;
  } else if (container.vertical) {
    result += widthSum;
  } else {
    result = widthMax;
  }
  return result;
}

export function minHorizontal(container: ViewNode): number {
  let heightSum = 0;
  let heightMax = SIZE_SPLIT_MIN_HEIGHT;
  container.children.forEach((view: ViewNode) => {
    const height = minHorizontal(view);
    if (container.horizontal) {
      heightSum += height;
    } else if (heightMax < height) {
      heightMax = height;
    }
  });
  let result = 0;
  if (container.horizontal && container.children.length === 0) {
    result = SIZE_SPLIT_MIN_HEIGHT;
  } else if (container.horizontal) {
    result += heightSum;
  } else {
    result = heightMax;
  }
  return result;
}

export function deleteByView(view: ViewNode) {
  const [viewState, viewActions] = useViewStore();
  if (view && view.parent) {
    const parent = view.parent;
    const currentIndex = parent.children.indexOf(view);
    parent.children.splice(currentIndex, 1);
    resetSize(parent);
    if (viewState.focusView?.id === view.id) {
      viewActions.viewFocusEnd();
    }
  }
}

export function split(
  container: ViewNode,
  placement: Placement,
  tab: Tab,
  tabView: ViewNode,
  targetView: ViewNode
) {
  if (placement !== Placement.all) {
    if (targetView.parent) {
      const parentView = targetView.parent;
      const currentIndex = tabView.tabs.indexOf(tab);
      tabView.tabs.splice(currentIndex, 1);
      if (tabView.tabs.length === 0) {
        deleteByView(tabView);
      }
      switch (placement) {
        case Placement.top:
          if (parentView.vertical) {
            // children split
            const tabs = targetView.tabs;
            targetView.tabs = [];
            targetView.vertical = false;
            targetView.horizontal = true;
            targetView.children.push(addView(targetView, [tab]));
            targetView.children.push(addView(targetView, tabs));
            resetSize(targetView);
          } else if (parentView.horizontal) {
            // parent add
            const targetIndex = parentView.children.indexOf(targetView);
            parentView.children.splice(
              targetIndex,
              0,
              addView(parentView, [tab])
            );
            resetSize(parentView);
          }
          break;
        case Placement.bottom:
          if (parentView.vertical) {
            // children split
            const tabs = targetView.tabs;
            targetView.tabs = [];
            targetView.vertical = false;
            targetView.horizontal = true;
            targetView.children.push(addView(targetView, tabs));
            targetView.children.push(addView(targetView, [tab]));
            resetSize(targetView);
          } else if (parentView.horizontal) {
            // parent add
            const targetIndex = parentView.children.indexOf(targetView);
            parentView.children.splice(
              targetIndex + 1,
              0,
              addView(parentView, [tab])
            );
            resetSize(parentView);
          }
          break;
        case Placement.left:
          if (parentView.vertical) {
            // parent add
            const targetIndex = parentView.children.indexOf(targetView);
            parentView.children.splice(
              targetIndex,
              0,
              addView(parentView, [tab])
            );
            resetSize(parentView);
          } else if (parentView.horizontal) {
            // children split
            const tabs = targetView.tabs;
            targetView.tabs = [];
            targetView.vertical = true;
            targetView.horizontal = false;
            targetView.children.push(addView(targetView, [tab]));
            targetView.children.push(addView(targetView, tabs));
            resetSize(targetView);
          }
          break;
        case Placement.right:
          if (parentView.vertical) {
            // parent add
            const targetIndex = parentView.children.indexOf(targetView);
            parentView.children.splice(
              targetIndex + 1,
              0,
              addView(parentView, [tab])
            );
            resetSize(parentView);
          } else if (parentView.horizontal) {
            // children split
            const tabs = targetView.tabs;
            targetView.tabs = [];
            targetView.vertical = true;
            targetView.horizontal = false;
            targetView.children.push(addView(targetView, tabs));
            targetView.children.push(addView(targetView, [tab]));
            resetSize(targetView);
          }
          break;
      }
    }
  }
}

export function addView(parent: ViewNode, tabs: Tab[]): ViewNode {
  const [, viewActions] = useViewStore();
  const view = new ViewNode({
    node: {
      parent,
      tabs,
    },
  });
  viewActions.viewFocusStart(view);
  return view;
}

export function tabGroups(
  container: ViewNode,
  groups: ViewNode[] = []
): ViewNode[] {
  if (container.tabs.length !== 0) {
    groups.push(container);
  }
  container.children.forEach((view: ViewNode) => {
    tabGroups(view, groups);
  });
  return groups;
}
