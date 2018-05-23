class Rect {
    constructor(left, top, right, bottom) {
        this.left = left || 0;
        this.top = top || 0;
        this.right = right || 0;
        this.bottom = bottom || 0;
        this.creationTimestamp = new Date().getTime();
        this.tags = [];
    }

    width() {
        return this.right - this.left;
    }

    height() {
        return this.bottom - this.top;
    }

    centerX() {
        return this.left + (this.width() * 0.5);
    }

    centerY() {
        return this.top + (this.height() * 0.5);
    }

    area() {
        return this.width() * this.height();
    }

    static fromObject(rectParams) {
        var rect = new Rect(rectParams.left, rectParams.top, rectParams.right, rectParams.bottom);
        rect.creationTimestamp = rectParams.creationTimestamp;
        rect.tags = rectParams.tags;
        return rect;
    }
}

window.Rect = Rect;
